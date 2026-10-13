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
import { textChunks } from './text-windows.js';
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
            const maxChars = this.provider.maxChars;
            const chunks = maxChars == null ? [trimmed] : textChunks(trimmed, maxChars);
            if (chunks.length === 0) {
                const notice = decideSafety(['illegal_harm'], surface, this.config.helplines);
                if (notice) {
                    this.logNotice(notice, surface, ctx, trimmed.length, ['over_limit']);
                }
                return notice;
            }
            for (const chunk of chunks) {
                const started = Date.now();
                try {
                    const remote = await this.provider.moderate(chunk);
                    categories = merge(categories, remote.categories);
                    if (categories.length > 0) break;
                } catch (error) {
                    const name = error instanceof Error ? error.name : 'Error';
                    const failure = describeProviderFailure(error, chunk);
                    this.logger.warn(
                        [
                            'moderation.provider_error',
                            `provider=${this.provider.id === 'openai' ? 'openai' : 'gemini'}`,
                            `status=${failure.status}`,
                            `code=${failure.code}`,
                            `model=${this.provider.model ?? '-'}`,
                            `latencyMs=${Date.now() - started}`,
                            ...(failure.message ? [`message=${failure.message}`] : []),
                        ].join(' '),
                    );
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
                    const rateLimited = failure.status === '429';
                    // Output keeps locally clean text. Input does that only for 429/quota.
                    // Persona stays fail-closed. Local categories already collected still decide.
                    if (surface === 'output' || (surface === 'input' && rateLimited)) {
                        const reason = rateLimited ? 'rate_limited' : 'provider_error';
                        this.logger.warn(
                            `moderation.degraded fallback=local reason=${reason}`,
                        );
                        break;
                    }
                    if (!this.config.failClosed) return null;
                    const notice = unavailableNotice();
                    this.logNotice(notice, surface, ctx, trimmed.length, ['provider_error']);
                    return notice;
                }
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

type ProviderFailureStatus = 'http' | 'timeout' | 'parse' | '429';

interface ProviderFailure {
    status: ProviderFailureStatus;
    code: string;
    message: string;
}

/** Shape of a provider failure for the structured log. Never includes user text or keys. */
export function describeProviderFailure(error: unknown, userText: string): ProviderFailure {
    if (isRateLimited(error)) {
        const message = error instanceof Error && error.name === 'ApiError'
            ? redactProviderMessage(error.message, userText)
            : '';
        return { status: '429', code: rateLimitCode(error), message };
    }
    if (isProviderTimeout(error)) {
        const code = error instanceof Error && error.name ? error.name : 'timeout';
        return { status: 'timeout', code, message: '' };
    }
    if (isParseError(error)) {
        return { status: 'parse', code: 'parse', message: '' };
    }
    const status = httpStatus(error);
    const message = error instanceof Error && error.name === 'ApiError'
        ? redactProviderMessage(error.message, userText)
        : '';
    return {
        status: 'http',
        code: status === undefined ? 'unknown' : String(status),
        message,
    };
}

export function redactProviderMessage(message: string, userText: string): string {
    let text = message.replace(/\s+/g, ' ').trim();
    if (userText) text = text.split(userText).join('[redacted]');
    text = text
        .replace(/AIza[0-9A-Za-z_-]{8,}/g, '[redacted]')
        .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, '[redacted]')
        .replace(
            /((?:api[_-]?key|key|token|authorization|bearer)\s*[=:]\s*)[^\s&,"']+/gi,
            '$1[redacted]',
        );
    if (text.length > 300) text = `${text.slice(0, 300)}...`;
    return text;
}

function isRateLimited(error: unknown): boolean {
    if (httpStatus(error) === 429) return true;
    const message = error instanceof Error ? error.message : '';
    const code = error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';
    return /RESOURCE_EXHAUSTED|\bquota\b|rate[_ ]limit|too many requests/i.test(`${code} ${message}`);
}

function rateLimitCode(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    const code = error && typeof error === 'object' && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : '';
    if (/RESOURCE_EXHAUSTED/i.test(`${code} ${message}`)) return 'RESOURCE_EXHAUSTED';
    if (code.trim()) return code.trim();
    if (/\bquota\b/i.test(message)) return 'quota';
    return 'RESOURCE_EXHAUSTED';
}

function httpStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 100 && status <= 599) return status;
    return undefined;
}

function isProviderTimeout(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as { name?: unknown; code?: unknown; status?: unknown };
    if (record.name === 'ApiError' && typeof record.status === 'number') return false;
    if (record.name === 'TimeoutError' || record.name === 'AbortError') return true;
    if (record.code === 'ETIMEDOUT' || record.code === 'ABORT_ERR' || record.code === 23) {
        return true;
    }
    const message = error instanceof Error ? error.message : '';
    return /timeout|timed out|\baborted\b/i.test(message);
}

function isParseError(error: unknown): boolean {
    if (!(error instanceof Error) || error.name === 'ApiError') return false;
    return /no JSON|invalid JSON|empty response|returned no result/i.test(error.message);
}
