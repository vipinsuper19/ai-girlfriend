import { Injectable, Logger } from '@nestjs/common';

import type { ContentModerator } from './content-moderator.js';
import type { SafetyConfig } from './safety.config.js';
import {
    assessLocal,
    decideSafety,
    personaMinorAge,
    personaText,
    unavailableNotice,
    type ModerationSurface,
    type PersonaDraft,
    type SafetyCategory,
    type SafetyLogContext,
    type SafetyNotice,
} from './safety-policy.js';
import { UnsafePersonaException } from './unsafe-persona.exception.js';

export interface SafetyLogger {
    warn(message: string): void;
}

@Injectable()
export class ModerationService {
    private readonly logger: SafetyLogger;

    constructor(
        private readonly config: SafetyConfig,
        private readonly provider: ContentModerator,
        logger?: SafetyLogger,
    ) {
        this.logger = logger ?? new Logger(ModerationService.name);
    }

    /**
     * @returns a client notice when the text must not reach the model or the user.
     * `null` means the text may continue.
     */
    async noticeFor(
        text: string,
        surface: ModerationSurface,
        ctx: SafetyLogContext = {},
        extra: SafetyCategory[] = [],
    ): Promise<SafetyNotice | null> {
        if (!this.config.enabled) return null;

        const trimmed = text.trim();
        let categories = [...extra];
        if (trimmed) {
            categories = merge(categories, assessLocal(trimmed, surface));
        }
        if (categories.length === 0 && trimmed && this.provider.id !== 'local') {
            try {
                const remote = await this.provider.moderate(trimmed);
                categories = merge(categories, remote.categories);
            } catch (error) {
                const name = error instanceof Error ? error.name : 'Error';
                this.logger.warn(
                    [
                        'safety',
                        `provider=${this.provider.id}`,
                        'failed',
                        `name=${name}`,
                        `surface=${surface}`,
                        `chars=${trimmed.length}`,
                        `userId=${ctx.userId ?? '-'}`,
                        `conversationId=${ctx.conversationId ?? '-'}`,
                    ].join(' '),
                );
                if (!this.config.failClosed) return null;
                const notice = unavailableNotice();
                this.logNotice(notice, surface, ctx, trimmed.length, ['provider_error']);
                return notice;
            }
        }

        const notice = decideSafety(categories, surface, this.config.helplines);
        if (!notice) return null;
        this.logNotice(notice, surface, ctx, trimmed.length, categories);
        return notice;
    }

    async assertSafePersona(
        draft: PersonaDraft,
        ctx: SafetyLogContext = {},
    ): Promise<void> {
        const extra: SafetyCategory[] = personaMinorAge(draft) ? ['minor'] : [];
        const notice = await this.noticeFor(personaText(draft), 'persona', ctx, extra);
        if (notice) throw new UnsafePersonaException();
    }

    private logNotice(
        notice: SafetyNotice,
        surface: ModerationSurface,
        ctx: SafetyLogContext,
        chars: number,
        categories: string[],
    ): void {
        this.logger.warn(
            [
                'safety',
                `surface=${surface}`,
                `action=${notice.action}`,
                `code=${notice.code}`,
                `categories=${categories.join(',') || '-'}`,
                `chars=${chars}`,
                `userId=${ctx.userId ?? '-'}`,
                `conversationId=${ctx.conversationId ?? '-'}`,
            ].join(' '),
        );
    }
}

function merge(left: SafetyCategory[], right: SafetyCategory[]): SafetyCategory[] {
    return [...new Set([...left, ...right])];
}
