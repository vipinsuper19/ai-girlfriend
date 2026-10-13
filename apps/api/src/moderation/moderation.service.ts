import { HttpException, Injectable, Logger } from '@nestjs/common';

import {
    CLASSIFIER_TIMEOUT_MS,
    degradedReason,
    type DegradedReason,
    withAttemptTimeout,
} from './classifier-attempt.js';
import type { ContentModerator } from './content-moderator.js';
import { GEMINI_MODERATION_TIMEOUT_MS } from './gemini-moderator.js';
import { ModerationTemporarilyUnavailableException } from './moderation-unavailable.exception.js';
import type { SafetyConfig } from './safety.config.js';
import {
    assessLocal,
    decideSafety,
    personaMinorAge,
    personaRejectionMessage,
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

export interface ModerationRuntime {
    fallback?: ContentModerator | null;
    attemptTimeoutMs?: number;
}

@Injectable()
export class ModerationService {
    private readonly logger: SafetyLogger;
    private readonly attemptTimeoutMs: number;
    private readonly fallback: ContentModerator | null;

    constructor(
        private readonly config: SafetyConfig,
        private readonly provider: ContentModerator,
        logger?: SafetyLogger,
        runtime: ModerationRuntime = {},
    ) {
        this.logger = logger ?? new Logger(ModerationService.name);
        this.attemptTimeoutMs = runtime.attemptTimeoutMs
            ?? (provider.id === 'gemini' ? GEMINI_MODERATION_TIMEOUT_MS : CLASSIFIER_TIMEOUT_MS);
        this.fallback = runtime.fallback ?? null;
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
        return (await this.classify(text, surface, ctx, extra)).notice;
    }

    async assertSafePersona(
        draft: PersonaDraft,
        ctx: SafetyLogContext = {},
    ): Promise<void> {
        const extra: SafetyCategory[] = personaMinorAge(draft) ? ['minor'] : [];
        let outcome: { notice: SafetyNotice | null; categories: SafetyCategory[] };
        try {
            outcome = await this.classify(personaText(draft), 'persona', ctx, extra);
        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logLocalCheckFailed(ctx);
            throw new ModerationTemporarilyUnavailableException();
        }
        if (!outcome.notice) return;
        if (outcome.notice.code === 'moderation_unavailable') {
            throw new ModerationTemporarilyUnavailableException();
        }
        throw new UnsafePersonaException(personaRejectionMessage(outcome.categories));
    }

    /**
     * Local categories are always applied. The provider is one attempt with a
     * short timeout. A persona outage keeps that local verdict: minors and
     * sexual-minors stay blocked, the local explicit list stays blocked, and
     * everything else is allowed. Chat on this branch still fail-closes.
     */
    private async classify(
        text: string,
        surface: ModerationSurface,
        ctx: SafetyLogContext,
        extra: SafetyCategory[],
    ): Promise<{ notice: SafetyNotice | null; categories: SafetyCategory[] }> {
        if (!this.config.enabled) return { notice: null, categories: [] };

        const trimmed = text.trim();
        let categories = [...extra];
        if (trimmed) {
            categories = merge(categories, this.localCategories(trimmed, surface, ctx));
        }
        let fallbackUsed = false;
        if (categories.length === 0 && trimmed && this.provider.id !== 'local') {
            const maxChars = this.provider.maxChars;
            const chunks = maxChars == null ? [trimmed] : textChunks(trimmed, maxChars);
            if (chunks.length === 0) {
                const notice = decideSafety(['illegal_harm'], surface, this.config.helplines);
                if (notice) {
                    this.logNotice(notice, surface, ctx, trimmed.length, ['over_limit']);
                }
                return { notice, categories: notice ? ['illegal_harm'] : [] };
            }
            for (const chunk of chunks) {
                const started = Date.now();
                try {
                    const remote = await withAttemptTimeout(
                        this.provider.moderate(chunk),
                        this.attemptTimeoutMs,
                    );
                    categories = merge(categories, remote.categories);
                    if (categories.length > 0) break;
                } catch (error) {
                    if (isOverLimitError(error)) {
                        categories = merge(categories, ['illegal_harm']);
                        break;
                    }
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
                    const reason = degradedReason(error);
                    this.logOutage(error, reason, surface, ctx, trimmed.length, this.provider.id);
                    if (
                        !fallbackUsed
                        && (reason === '429' || reason === '503' || reason === 'timeout')
                    ) {
                        fallbackUsed = true;
                        const recovered = await this.tryFallback(chunk, surface, ctx, trimmed.length);
                        if (recovered) {
                            categories = merge(categories, recovered);
                            if (categories.length > 0) break;
                            continue;
                        }
                    }
                    if (surface === 'persona') break;
                    if (!this.config.failClosed) return { notice: null, categories };
                    const notice = unavailableNotice();
                    this.logNotice(notice, surface, ctx, trimmed.length, ['provider_error']);
                    return { notice, categories };
                }
            }
        }

        const notice = this.decide(categories, surface, ctx);
        if (!notice) return { notice: null, categories };
        this.logNotice(notice, surface, ctx, trimmed.length, categories);
        return { notice, categories };
    }

    private localCategories(
        text: string,
        surface: ModerationSurface,
        ctx: SafetyLogContext,
    ): SafetyCategory[] {
        try {
            return assessLocal(text, surface);
        } catch (error) {
            if (surface !== 'persona') throw error;
            this.logLocalCheckFailed(ctx);
            throw new ModerationTemporarilyUnavailableException();
        }
    }

    private decide(
        categories: SafetyCategory[],
        surface: ModerationSurface,
        ctx: SafetyLogContext,
    ): SafetyNotice | null {
        try {
            return decideSafety(categories, surface, this.config.helplines);
        } catch (error) {
            if (surface !== 'persona') throw error;
            this.logLocalCheckFailed(ctx);
            throw new ModerationTemporarilyUnavailableException();
        }
    }

    /**
     * One OpenAI moderations call after a quota, 503, or timeout.
     * `null` means there is no fallback or that call also failed.
     */
    private async tryFallback(
        text: string,
        surface: ModerationSurface,
        ctx: SafetyLogContext,
        chars: number,
    ): Promise<SafetyCategory[] | null> {
        const fallback = this.fallback;
        if (!fallback || fallback.id === this.provider.id) return null;
        try {
            const remote = await withAttemptTimeout(
                fallback.moderate(text),
                this.attemptTimeoutMs,
            );
            return remote.categories;
        } catch (error) {
            if (!isOverLimitError(error)) {
                this.logOutage(error, degradedReason(error), surface, ctx, chars, fallback.id);
            }
            return null;
        }
    }

    private logOutage(
        error: unknown,
        reason: DegradedReason,
        surface: ModerationSurface,
        ctx: SafetyLogContext,
        chars: number,
        providerId: string,
    ): void {
        const tail = [
            `provider=${providerId}`,
            `reason=${reason}`,
            `surface=${surface}`,
            `chars=${chars}`,
            `userId=${ctx.userId ?? '-'}`,
            `conversationId=${ctx.conversationId ?? '-'}`,
        ];
        if (reason === '429') {
            this.logger.warn(['safety', 'provider quota exhausted', ...tail].join(' '));
            return;
        }
        if (surface === 'persona' || reason === '503' || reason === 'timeout') {
            this.logger.warn(['safety', 'degraded', ...tail].join(' '));
            return;
        }
        const name = error instanceof Error ? error.name : 'Error';
        this.logger.warn(
            ['safety', `provider=${providerId}`, 'failed', `name=${name}`, ...tail].join(' '),
        );
    }

    private logLocalCheckFailed(ctx: SafetyLogContext): void {
        this.logger.warn(
            [
                'safety',
                'local-check-failed',
                'surface=persona',
                `userId=${ctx.userId ?? '-'}`,
                `conversationId=${ctx.conversationId ?? '-'}`,
            ].join(' '),
        );
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

function isOverLimitError(error: unknown): boolean {
    return error instanceof Error && /exceeds the provider limit/i.test(error.message);
}

type ProviderFailureStatus = 'http' | 'timeout' | 'parse';

interface ProviderFailure {
    status: ProviderFailureStatus;
    code: string;
    message: string;
}

/** Shape of a provider failure for the structured log. Never includes user text or keys. */
export function describeProviderFailure(error: unknown, userText: string): ProviderFailure {
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
