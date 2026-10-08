import {
    BadGatewayException,
    BadRequestException,
    ConflictException,
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common';
import type { GoogleAuth } from 'google-auth-library';

import { googleAuthFor, parseServiceAccount } from '../common/google-service-account.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GooglePlayPurchaseDto } from './dto/google-play-purchase.dto.js';
import {
    playAccountId,
    playProducts,
    playVerdict,
    type PaidPlan,
    type PlaySubscription,
} from './google-play.js';
import { SubscriptionsService } from './subscriptions.service.js';

const PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const PUBLISHER_API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
export const GOOGLE_PLAY_PROVIDER = 'GOOGLE_PLAY';

type Play = { auth: GoogleAuth; packageName: string; products: Map<string, PaidPlan> };

@Injectable()
export class GooglePlayService {
    private play: Play | null | undefined;

    constructor(
        private readonly prisma: PrismaService,
        private readonly subscriptions: SubscriptionsService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    /** Needs GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, GOOGLE_PLAY_PACKAGE_NAME, and GOOGLE_PLAY_PRODUCTS. */
    private getPlay(): Play | null {
        if (this.play !== undefined) return this.play;
        const account = parseServiceAccount(process.env['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON']);
        const packageName = process.env['GOOGLE_PLAY_PACKAGE_NAME']?.trim();
        const products = playProducts(process.env['GOOGLE_PLAY_PRODUCTS']);
        this.play = account && packageName && products.size
            ? { auth: googleAuthFor(account, PUBLISHER_SCOPE), packageName, products }
            : null;
        return this.play;
    }

    private accountId(userId: number): string {
        return playAccountId(userId, process.env['JWT_ACCESS_SECRET'] ?? '');
    }

    config(userId: number) {
        const play = this.getPlay();
        if (!play) {
            return { configured: false, products: [], accountId: null };
        }
        return {
            configured: true,
            packageName: play.packageName,
            products: [...play.products].map(([productId, plan]) => ({ productId, plan })),
            accountId: this.accountId(userId),
        };
    }

    async verify(userId: number, dto: GooglePlayPurchaseDto) {
        const play = this.getPlay();
        if (!play) {
            throw new ServiceUnavailableException('Google Play billing is not configured');
        }
        const plan = play.products.get(dto.productId);
        if (!plan) {
            throw new BadRequestException('Unknown product');
        }

        const claimed = await this.db.orm.public.Subscription
            .where({ providerSubscriptionId: dto.purchaseToken })
            .first();
        if (claimed && claimed.userId !== userId) {
            throw new ConflictException('This purchase belongs to a different account');
        }

        const purchase = await this.fetchPurchase(play, dto.purchaseToken);
        const verdict = playVerdict(purchase, {
            productId: dto.productId,
            accountId: this.accountId(userId),
            now: new Date(),
        });
        if (!verdict.ok) {
            throw new BadRequestException(verdict.problem);
        }

        if (verdict.needsAcknowledge) {
            await this.publisher(play, 'POST',
                `/purchases/subscriptions/${encodeURIComponent(dto.productId)}/tokens/${encodeURIComponent(dto.purchaseToken)}:acknowledge`,
                {});
        }

        if (verdict.linkedPurchaseToken) {
            const replaced = await this.db.orm.public.Subscription
                .where({ providerSubscriptionId: verdict.linkedPurchaseToken, userId })
                .first();
            if (replaced) {
                await this.db.orm.public.Subscription
                    .where({ id: replaced.id })
                    .update({ status: 'CANCELED' });
            }
        }

        return this.subscriptions.activateProviderSubscription({
            userId,
            plan,
            provider: GOOGLE_PLAY_PROVIDER,
            providerSubscriptionId: dto.purchaseToken,
            expiresAt: verdict.expiresAt,
        });
    }

    private async fetchPurchase(play: Play, token: string): Promise<PlaySubscription> {
        try {
            return await this.publisher(play, 'GET', `/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`);
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw new BadRequestException('Google Play does not recognize this purchase');
            }
            throw error;
        }
    }

    private async publisher(play: Play, method: 'GET' | 'POST', path: string, data?: unknown): Promise<any> {
        const client = await play.auth.getClient();
        try {
            const response = await client.request({
                url: `${PUBLISHER_API}/${encodeURIComponent(play.packageName)}${path}`,
                method,
                ...(data === undefined ? {} : { data }),
            });
            return response.data;
        } catch (error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            if (status === 400 || status === 404 || status === 410) {
                throw new BadRequestException('Google Play refused this purchase');
            }
            throw new BadGatewayException('Google Play could not be reached');
        }
    }
}
