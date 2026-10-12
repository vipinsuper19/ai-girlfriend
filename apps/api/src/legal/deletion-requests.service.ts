import { Inject, Injectable, Logger } from '@nestjs/common';

import { MailService } from '../mail/mail.service.js';
import { APP_NAME, contactEmail, contactEmailIsConfigured, developerName } from './contact.js';
import {
    DELETION_REQUEST_STORE,
    type DeletionRequestStore,
} from './deletion-request.store.js';
import { deletionResultHtml, type LegalIdentity } from './pages.js';
import { SlidingWindowLimiter } from './rate-limit.js';

const EMAIL_MAX = 320;
const NOTE_MAX = 2000;

export type DeletionSubmission = {
    status: 200 | 400 | 429;
    html: string;
};

@Injectable()
export class DeletionRequestsService {
    private readonly logger = new Logger(DeletionRequestsService.name);

    constructor(
        @Inject(DELETION_REQUEST_STORE)
        private readonly store: DeletionRequestStore,
        @Inject(SlidingWindowLimiter)
        private readonly limiter: SlidingWindowLimiter,
        @Inject(MailService)
        private readonly mail: MailService,
    ) {}

    identity(): LegalIdentity {
        return {
            contactEmail: contactEmail(),
            developerName: developerName(),
        };
    }

    async submit(
        input: { email?: unknown; note?: unknown },
        clientKey: string,
    ): Promise<DeletionSubmission> {
        const identity = this.identity();
        const email = normalizeEmail(input.email);
        const note = normalizeNote(input.note);

        if (!email) {
            return {
                status: 400,
                html: deletionResultHtml({ identity, status: 'invalid' }),
            };
        }

        if (!this.limiter.allow(clientKey)) {
            return {
                status: 429,
                html: deletionResultHtml({ identity, status: 'limited', email }),
            };
        }

        const createdAt = new Date().toISOString();
        await this.store.save({ email, note, createdAt });

        if (contactEmailIsConfigured(identity.contactEmail)) {
            const sent = await this.mail.send({
                to: identity.contactEmail,
                subject: `${APP_NAME} account deletion request`,
                text: [
                    `App: ${APP_NAME}`,
                    `Account email: ${email}`,
                    `Requested at: ${createdAt}`,
                    note ? `Note: ${note}` : 'Note: (none)',
                ].join('\n'),
            });
            if (!sent) {
                this.logger.error(`Deletion request for ${email} was stored but not emailed`);
            }
        }

        return {
            status: 200,
            html: deletionResultHtml({ identity, status: 'received', email }),
        };
    }
}

export function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    if (email.length === 0 || email.length > EMAIL_MAX) return null;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
    return email;
}

export function normalizeNote(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, NOTE_MAX);
}
