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

export interface MemoryBlock {
    id: string;
    content: string;
}

export interface TurnModeration {
    notice: SafetyNotice | null;
    /** True when this turn, or a stored flag, says a minor is present. */
    holdMinor: boolean;
    allowedMemoryIds: string[];
}

const CACHE_MAX = 200;

@Injectable()
export class ModerationService {
    private readonly logger: SafetyLogger;
    private readonly cache = new Map<string, SafetyCategory[]>();

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
        if (ctx.heldMinor) categories = merge(categories, ['minor']);
        if (trimmed) {
            categories = merge(categories, assessLocal(trimmed, surface));
            categories = merge(categories, this.minorFromHistory(ctx));
        }
        const localCrisis = surface === 'input' && categories.includes('self_harm');
        if (!localCrisis && categories.length === 0 && trimmed && this.provider.id !== 'local') {
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
                try {
                    const remote = await this.provider.moderate(chunk);
                    categories = merge(categories, remote.categories);
                    if (categories.length > 0) break;
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

    /**
     * One classifier call for the user turn and any memory lines that are not
     * already cached. A local crisis phrase skips the call.
     */
    async moderateTurn(input: {
        text: string;
        memories?: readonly MemoryBlock[];
        ctx?: SafetyLogContext;
    }): Promise<TurnModeration> {
        const ctx = input.ctx ?? {};
        const memories = input.memories ?? [];
        if (!this.config.enabled) {
            return {
                notice: null,
                holdMinor: false,
                allowedMemoryIds: memories.map((memory) => memory.id),
            };
        }

        const text = input.text.trim();
        let userCategories = assessLocal(text, 'input');
        if (ctx.heldMinor) userCategories = merge(userCategories, ['minor']);
        userCategories = merge(userCategories, this.minorFromHistory(ctx));

        const memoryCategories = new Map<string, SafetyCategory[]>();
        for (const memory of memories) {
            memoryCategories.set(memory.id, assessLocal(memory.content, 'input'));
        }

        if (!userCategories.includes('self_harm') && this.provider.id !== 'local') {
            const pending: { id: string; text: string }[] = [];
            const recalledUser = text ? this.recall(text) : undefined;
            if (recalledUser) userCategories = merge(userCategories, recalledUser);
            else if (text) pending.push({ id: 'user', text });
            for (const memory of memories) {
                const recalled = this.recall(memory.content);
                if (recalled) {
                    memoryCategories.set(
                        memory.id,
                        merge(memoryCategories.get(memory.id) ?? [], recalled),
                    );
                } else if (memory.content.trim()) {
                    pending.push({ id: memory.id, text: memory.content });
                }
            }
            if (pending.length > 0) {
                const scored = await this.scoreBlocks(pending, ctx);
                if (scored === 'unavailable') {
                    if (!holdsMinor(userCategories)) {
                        const notice = unavailableNotice();
                        this.logNotice(notice, 'input', ctx, text.length, ['provider_error']);
                        return { notice, holdMinor: false, allowedMemoryIds: [] };
                    }
                } else {
                    for (const block of pending) {
                        const remote = scored.get(block.id) ?? [];
                        this.remember(block.text, remote);
                        if (block.id === 'user') userCategories = merge(userCategories, remote);
                        else {
                            memoryCategories.set(
                                block.id,
                                merge(memoryCategories.get(block.id) ?? [], remote),
                            );
                        }
                    }
                }
            }
        }

        const notice = decideSafety(userCategories, 'input', this.config.helplines);
        if (notice) this.logNotice(notice, 'input', ctx, text.length, userCategories);
        const allowedMemoryIds = memories
            .filter((memory) => this.memoryAllowed(memoryCategories.get(memory.id) ?? []))
            .map((memory) => memory.id);
        return {
            notice,
            holdMinor: holdsMinor(userCategories),
            allowedMemoryIds,
        };
    }

    private minorFromHistory(ctx: SafetyLogContext): SafetyCategory[] {
        const extra: SafetyCategory[] = [];
        for (const prior of ctx.priorTexts ?? []) {
            const categories = assessLocal(prior, 'input');
            if (categories.includes('sexual_minors')) return ['sexual_minors'];
            if (categories.includes('minor')) extra.push('minor');
        }
        return extra;
    }

    private memoryAllowed(categories: SafetyCategory[]): boolean {
        if (categories.includes('jailbreak')) return false;
        return decideSafety(categories, 'input', this.config.helplines) === null;
    }

    private async scoreBlocks(
        blocks: readonly { id: string; text: string }[],
        ctx: SafetyLogContext,
    ): Promise<Map<string, SafetyCategory[]> | 'unavailable'> {
        const body = blocks.length === 1 && blocks[0]?.id === 'user'
            ? blocks[0].text
            : blocks.map((block) => `[id=${block.id}]\n${block.text}`).join('\n\n');
        try {
            const remote = await this.provider.moderate(body);
            const scored = new Map<string, SafetyCategory[]>();
            if (remote.items && remote.items.length > 0) {
                for (const item of remote.items) scored.set(item.id, [...item.categories]);
            } else if (blocks.length === 1 && blocks[0]) {
                scored.set(blocks[0].id, [...remote.categories]);
            } else {
                const user = blocks.find((block) => block.id === 'user');
                if (user) scored.set(user.id, [...remote.categories]);
            }
            return scored;
        } catch (error) {
            const name = error instanceof Error ? error.name : 'Error';
            this.logger.warn(
                [
                    'safety',
                    `provider=${this.provider.id}`,
                    'failed',
                    `name=${name}`,
                    'surface=input',
                    `chars=${body.length}`,
                    `userId=${ctx.userId ?? '-'}`,
                    `conversationId=${ctx.conversationId ?? '-'}`,
                ].join(' '),
            );
            if (!this.config.failClosed) return new Map();
            return 'unavailable';
        }
    }

    private recall(text: string): SafetyCategory[] | undefined {
        const key = cacheKey(text);
        if (!this.cache.has(key)) return undefined;
        return this.cache.get(key) ?? [];
    }

    private remember(text: string, categories: SafetyCategory[]): void {
        const key = cacheKey(text);
        if (this.cache.has(key)) this.cache.delete(key);
        this.cache.set(key, categories);
        if (this.cache.size > CACHE_MAX) {
            const oldest = this.cache.keys().next().value;
            if (oldest !== undefined) this.cache.delete(oldest);
        }
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

function holdsMinor(categories: SafetyCategory[]): boolean {
    return categories.includes('minor') || categories.includes('sexual_minors');
}

function cacheKey(text: string): string {
    return text.trim();
}
