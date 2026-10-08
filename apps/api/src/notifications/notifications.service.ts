import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import type { GoogleAuth } from 'google-auth-library';

import { googleAuthFor, parseServiceAccount } from '../common/google-service-account.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RegisterDeviceDto } from './dto/register-device.dto.js';
import { fcmEndpoint, fcmMessage, isDeadToken, type Push } from './push-message.js';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

type Sender = { auth: GoogleAuth; projectId: string };

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private sender: Sender | null | undefined;

    constructor(private readonly prisma: PrismaService) { }

    private get db(): any {
        return this.prisma.client;
    }

    /** FIREBASE_SERVICE_ACCOUNT_JSON is required to send; FIREBASE_PROJECT_ID overrides the key's project. */
    private getSender(): Sender | null {
        if (this.sender !== undefined) return this.sender;
        const account = parseServiceAccount(process.env['FIREBASE_SERVICE_ACCOUNT_JSON']);
        const projectId = process.env['FIREBASE_PROJECT_ID']?.trim() || account?.project_id;
        this.sender = account && projectId
            ? { auth: googleAuthFor(account, FCM_SCOPE), projectId }
            : null;
        return this.sender;
    }

    status() {
        return { pushConfigured: this.getSender() !== null };
    }

    async registerDevice(userId: number, dto: RegisterDeviceDto) {
        const token = dto.token.trim();
        const existing = await this.db.orm.public.DeviceToken.where({ token }).first();

        if (existing) {
            return this.db.orm.public.DeviceToken
                .where({ id: existing.id })
                .update({ userId, platform: dto.platform });
        }

        return this.db.orm.public.DeviceToken.create({ userId, token, platform: dto.platform });
    }

    async removeDevice(userId: number, token: string) {
        const existing = await this.db.orm.public.DeviceToken
            .where({ token: token.trim(), userId })
            .first();
        if (!existing) {
            throw new NotFoundException('Device not found');
        }
        await this.db.orm.public.DeviceToken.where({ id: existing.id }).delete();
        return { token: existing.token, deleted: true };
    }

    async sendTest(userId: number) {
        if (!this.getSender()) {
            throw new ServiceUnavailableException('Push notifications are not configured');
        }
        const user = await this.db.orm.public.User.where({ id: userId }).first();
        if (!user?.notificationsEnabledAt) {
            throw new BadRequestException('Turn notifications on first');
        }
        const result = await this.sendToUser(userId, {
            title: 'Notifications are on',
            body: 'You will hear from her here.',
            data: { kind: 'test' },
        });
        if (result.devices === 0) {
            throw new BadRequestException('Register this device first');
        }
        return result;
    }

    /** Sends to every device of a user who has notifications on. Dead tokens are dropped. */
    async sendToUser(userId: number, push: Push) {
        const sender = this.getSender();
        const user = await this.db.orm.public.User.where({ id: userId }).first();
        if (!sender || !user?.notificationsEnabledAt) {
            return { devices: 0, sent: 0, removed: 0 };
        }

        const devices = await this.db.orm.public.DeviceToken.where({ userId }).all();
        const client = await sender.auth.getClient();
        let sent = 0;
        let removed = 0;

        for (const device of devices) {
            try {
                await client.request({
                    url: fcmEndpoint(sender.projectId),
                    method: 'POST',
                    data: fcmMessage(device.token, push),
                });
                sent += 1;
            } catch (error) {
                const response = (error as { response?: { status?: number; data?: unknown } }).response;
                if (response?.status && isDeadToken(response.status, response.data)) {
                    await this.db.orm.public.DeviceToken.where({ id: device.id }).delete();
                    removed += 1;
                } else {
                    this.logger.warn(`Push to device ${device.id} failed: ${(error as Error).message}`);
                }
            }
        }

        return { devices: devices.length, sent, removed };
    }
}
