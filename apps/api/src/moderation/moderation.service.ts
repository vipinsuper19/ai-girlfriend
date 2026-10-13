import { Injectable, Logger } from '@nestjs/common';

import {
    classifierBatchBody,
    fitClassifierBlocks,
    isOverLimitError,
    type ClassifierBlock,
} from './classifier-batch.js';
import {
    degradedReason,
    isEmptyClassifierResponse,
    type DegradedReason,
} from './classifier-attempt.js';
import type { ContentModerator } from './content-moderator.js';
import type { SafetyConfig } from './safety.config.js';
import {
    assessLocal,
    decideSafety,
    personaMinorAge,
    personaText,
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
    private degradedCount = 0;

    /** Classifier outages that used the local pre-filter instead of a hard refusal. */
    get degradedFallbacks(): number {
        return this.degradedCount;
    }

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
                    if (isOverLimitError(error)) {
                        categories = merge(categories, ['illegal_harm']);
                        break;
                    }
                    if (isEmptyClassifierResponse(error)) {
                        if (
                            holdsMinor(categories) ||
                            ctx.heldMinor === true ||
                            holdsMinor(assessLocal(chunk, surface))
                        ) {
                            categories = merge(categories, ['minor']);
                            break;
                        }
                        this.noteDegraded(error, surface, ctx, trimmed.length);
                        categories = merge(categories, ['illegal_harm']);
                        break;
                    }
                    this.noteDegraded(error, surface, ctx, trimmed.length);
                    break;
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

        const remoteRequired = this.provider.id !== 'local' && !userCategories.includes('self_harm');
        const scoredIds = new Set<string>();
        if (remoteRequired) {
            const pending: ClassifierBlock[] = [];
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
                    scoredIds.add(memory.id);
                } else if (memory.content.trim()) {
                    pending.push({ id: memory.id, text: memory.content });
                }
            }
            if (pending.length > 0) {
                const scored = await this.scoreBlocks(pending, ctx, text.length);
                if (scored) {
                    for (const block of pending) {
                        if (!scored.categories.has(block.id)) continue;
                        const remote = scored.categories.get(block.id) ?? [];
                        if (scored.cache) this.remember(block.text, remote);
                        scoredIds.add(block.id);
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
            .filter((memory) => {
                if (!this.memoryAllowed(memoryCategories.get(memory.id) ?? [])) return false;
                if (remoteRequired && !scoredIds.has(memory.id)) return false;
                return true;
            })
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

    /**
     * One classifier attempt, kept under the provider limit. `null` means the
     * call failed and the caller must keep the local verdict without caching
     * the miss. An over-limit body is chunked or refused, not treated as an outage.
     * An empty classifier body is a block, never a cached allow.
     */
    private async scoreBlocks(
        blocks: readonly ClassifierBlock[],
        ctx: SafetyLogContext,
        chars: number,
    ): Promise<BlockScore | null> {
        const maxChars = this.provider.maxChars;
        if (maxChars != null && maxChars < 1) {
            return this.overLimitVerdict(blocks);
        }
        if (maxChars != null) {
            const fitted = fitClassifierBlocks(blocks, maxChars);
            if (fitted.userOverLimit) {
                return this.scoreChunkedUser(fitted.blocks, maxChars, ctx, chars);
            }
            return this.scoreBody(fitted.blocks, ctx, chars);
        }
        return this.scoreBody(blocks, ctx, chars);
    }

    private async scoreChunkedUser(
        blocks: readonly ClassifierBlock[],
        maxChars: number,
        ctx: SafetyLogContext,
        chars: number,
    ): Promise<BlockScore | null> {
        const user = blocks.find((block) => block.id === 'user');
        if (!user) return { categories: new Map(), cache: true };
        const chunks = textChunks(user.text, maxChars);
        if (chunks.length === 0) return this.overLimitVerdict(blocks);
        const categories: SafetyCategory[] = [];
        for (const chunk of chunks) {
            try {
                const remote = await this.provider.moderate(chunk);
                categories.push(...remote.categories);
            } catch (error) {
                if (isOverLimitError(error)) return this.overLimitVerdict(blocks);
                return this.classifierFailure(error, blocks, ctx, chars);
            }
        }
        return { categories: new Map([[user.id, merge([], categories)]]), cache: true };
    }

    private async scoreBody(
        blocks: readonly ClassifierBlock[],
        ctx: SafetyLogContext,
        chars: number,
    ): Promise<BlockScore | null> {
        if (blocks.length === 0) return { categories: new Map(), cache: true };
        const body = classifierBatchBody(blocks);
        const maxChars = this.provider.maxChars;
        if (maxChars != null && maxChars > 0 && body.length > maxChars) {
            return this.overLimitVerdict(blocks);
        }
        try {
            const remote = await this.provider.moderate(body);
            const categories = new Map<string, SafetyCategory[]>();
            if (remote.items && remote.items.length > 0) {
                for (const item of remote.items) categories.set(item.id, [...item.categories]);
            } else if (blocks.length === 1 && blocks[0]) {
                categories.set(blocks[0].id, [...remote.categories]);
            } else {
                const user = blocks.find((block) => block.id === 'user');
                if (user) categories.set(user.id, [...remote.categories]);
            }
            for (const block of blocks) {
                if (!categories.has(block.id)) categories.set(block.id, []);
            }
            return { categories, cache: true };
        } catch (error) {
            if (isOverLimitError(error)) return this.overLimitVerdict(blocks);
            return this.classifierFailure(error, blocks, ctx, chars);
        }
    }

    /**
     * An empty classifier response blocks. A minor signal uses the local
     * verdict and is not counted as degraded. Anything else is a degraded
     * refusal and is not cached as an allow.
     */
    private classifierFailure(
        error: unknown,
        blocks: readonly ClassifierBlock[],
        ctx: SafetyLogContext,
        chars: number,
    ): BlockScore | null {
        if (!isEmptyClassifierResponse(error)) {
            this.noteDegraded(error, 'input', ctx, chars);
            return null;
        }
        if (this.hasMinorSignal(blocks, ctx)) return null;
        this.noteDegraded(error, 'input', ctx, chars);
        const categories = new Map<string, SafetyCategory[]>();
        for (const block of blocks) {
            if (block.id === 'user') categories.set(block.id, ['illegal_harm']);
        }
        return { categories, cache: false };
    }

    private hasMinorSignal(
        blocks: readonly ClassifierBlock[],
        ctx: SafetyLogContext,
    ): boolean {
        if (ctx.heldMinor) return true;
        return blocks.some((block) => holdsMinor(assessLocal(block.text, 'input')));
    }

    private overLimitVerdict(blocks: readonly ClassifierBlock[]): BlockScore {
        const categories = new Map<string, SafetyCategory[]>();
        for (const block of blocks) {
            if (block.id === 'user') categories.set(block.id, ['illegal_harm']);
        }
        return { categories, cache: true };
    }

    private noteDegraded(
        error: unknown,
        surface: ModerationSurface,
        ctx: SafetyLogContext,
        chars: number,
    ): void {
        const reason: DegradedReason = degradedReason(error);
        this.degradedCount += 1;
        this.logger.warn(
            [
                'moderation.degraded',
                `provider=${this.provider.id}`,
                `reason=${reason}`,
                `fallbacks=${this.degradedCount}`,
                `surface=${surface}`,
                `chars=${chars}`,
                `userId=${ctx.userId ?? '-'}`,
                `conversationId=${ctx.conversationId ?? '-'}`,
            ].join(' '),
        );
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

interface BlockScore {
    categories: Map<string, SafetyCategory[]>;
    /** False for an empty classifier body, so a later real score can replace it. */
    cache: boolean;
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
