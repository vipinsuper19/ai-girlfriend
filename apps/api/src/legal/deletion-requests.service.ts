import { Inject, Injectable, Logger } from '@nestjs/common';

import { MailService } from '../mail/mail.service.js';
import { APP_NAME, contactEmail, contactEmailIsConfigured, developerName } from './contact.js';
import {
    DELETION_REQUEST_STORE,
    type DeletionRequestStore,
} from './deletion-request.store.js';
import { deletionConfirmLink, deletionConfirmMail, hashDeletionToken, newDeletionToken } from './deletion-link.js';
import { deletionResultHtml, type LegalIdentity } from './pages.js';
import { SlidingWindowLimiter } from './rate-limit.js';

const EMAIL_MAX = 320;
const NOTE_MAX = 2000;
const TOKEN_MAX = 200;

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
        origin: string,
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

        const token = newDeletionToken();
        const createdAt = new Date().toISOString();
        await this.store.save({
            email,
            note,
            tokenHash: hashDeletionToken(token),
            createdAt,
        });

        const link = deletionConfirmLink(origin, token);
        const sent = await this.mail.send({
            to: email,
            subject: `${APP_NAME} account deletion confirmation`,
            text: deletionConfirmMail(link),
        });

        if (!sent) {
            this.logger.error(`Deletion confirmation for ${email} was stored but not emailed`);
            await this.notifyDeveloper(identity, {
                email,
                note,
                createdAt,
                confirmed: false,
            });
            return {
                status: 200,
                html: deletionResultHtml({ identity, status: 'unverified', email }),
            };
        }

        return {
            status: 200,
            html: deletionResultHtml({ identity, status: 'emailed', email }),
        };
    }

    async confirm(token: unknown): Promise<DeletionSubmission> {
        const identity = this.identity();
        const value = typeof token === 'string' ? token.trim() : '';
        if (!value || value.length > TOKEN_MAX) {
            return {
                status: 400,
                html: deletionResultHtml({ identity, status: 'confirm-invalid' }),
            };
        }

        const result = await this.store.confirm(hashDeletionToken(value));
        if (result.status === 'missing') {
            return {
                status: 400,
                html: deletionResultHtml({ identity, status: 'confirm-invalid' }),
            };
        }
        if (result.status === 'confirmed') {
            await this.notifyDeveloper(identity, {
                email: result.email,
                note: result.note,
                createdAt: result.createdAt,
                confirmed: true,
            });
        }
        return {
            status: 200,
            html: deletionResultHtml({
                identity,
                status: result.status === 'already' ? 'confirm-already' : 'confirmed',
                email: result.email,
            }),
        };
    }

    private async notifyDeveloper(
        identity: LegalIdentity,
        request: { email: string; note: string; createdAt: string; confirmed: boolean },
    ): Promise<void> {
        if (!contactEmailIsConfigured(identity.contactEmail)) return;
        const sent = await this.mail.send({
            to: identity.contactEmail,
            subject: `${APP_NAME} account deletion request`,
            text: [
                `App: ${APP_NAME}`,
                `Account email: ${request.email}`,
                `Requested at: ${request.createdAt}`,
                request.confirmed
                    ? 'Confirmation: the account email opened the link.'
                    : 'Confirmation: the link could not be emailed. Verify this request from the account email address before deleting.',
                request.note ? `Note: ${request.note}` : 'Note: (none)',
            ].join('\n'),
        });
        if (!sent) {
            this.logger.error(`Deletion request for ${request.email} was stored but the developer was not emailed`);
        }
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
