import { UsageFeatureDto } from './dto/record-usage.dto.js';
import type { UsageLimit, SubscriptionPlan } from './usage-limits.js';
import { USAGE_LIMITS } from './usage-limits.js';
import { usageWindow, type UsagePeriod } from './usage-window.js';

/** Successful replies a free account can receive per period before the cap. */
export const DEFAULT_FREE_TIER_MESSAGE_LIMIT = 40;

/** Estimated tokens (user text + reply) a free account can spend per period. */
export const DEFAULT_FREE_TIER_TOKEN_LIMIT = 50_000;

export type FreeTierLlmConfig = {
    period: UsagePeriod;
    messageLimit: number | null;
    tokenLimit: number | null;
};

/**
 * Free-tier chat cap. `unlimited` or a blank override is not accepted for the
 * numeric limits except the explicit word `unlimited`. `0` blocks new usage.
 * Unknown periods fall back to a UTC day so a typo cannot silently remove the cap.
 */
export function freeTierLlmConfig(
    env: NodeJS.ProcessEnv = process.env,
): FreeTierLlmConfig {
    return {
        period: parsePeriod(env['FREE_TIER_LLM_PERIOD']),
        messageLimit: parseLimit(
            env['FREE_TIER_LLM_MESSAGE_LIMIT'],
            DEFAULT_FREE_TIER_MESSAGE_LIMIT,
        ),
        tokenLimit: parseLimit(
            env['FREE_TIER_LLM_TOKEN_LIMIT'],
            DEFAULT_FREE_TIER_TOKEN_LIMIT,
        ),
    };
}

export function isFreeTierLlmFeature(feature: UsageFeatureDto): boolean {
    return feature === UsageFeatureDto.MESSAGES
        || feature === UsageFeatureDto.TEXT_TOKENS;
}

export function periodFor(
    plan: SubscriptionPlan,
    feature: UsageFeatureDto,
    env: NodeJS.ProcessEnv = process.env,
): UsagePeriod {
    if (plan === 'FREE' && isFreeTierLlmFeature(feature)) {
        return freeTierLlmConfig(env).period;
    }
    return 'month';
}

export function limitFor(
    plan: SubscriptionPlan,
    feature: UsageFeatureDto,
    env: NodeJS.ProcessEnv = process.env,
): UsageLimit | undefined {
    if (plan === 'FREE' && feature === UsageFeatureDto.MESSAGES) {
        return freeTierLlmConfig(env).messageLimit;
    }
    if (plan === 'FREE' && feature === UsageFeatureDto.TEXT_TOKENS) {
        return freeTierLlmConfig(env).tokenLimit;
    }
    return USAGE_LIMITS[plan]?.[feature];
}

export function windowFor(
    plan: SubscriptionPlan,
    feature: UsageFeatureDto,
    now = new Date(),
    env: NodeJS.ProcessEnv = process.env,
): { start: string; end: string; period: UsagePeriod } {
    const period = periodFor(plan, feature, env);
    return { ...usageWindow(period, now), period };
}

function parsePeriod(raw: string | undefined): UsagePeriod {
    const value = raw?.trim().toLowerCase();
    if (value === 'month' || value === 'monthly') return 'month';
    return 'day';
}

function parseLimit(raw: string | undefined, fallback: number): number | null {
    if (raw == null || raw.trim() === '') return fallback;
    const value = raw.trim().toLowerCase();
    if (value === 'unlimited') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return fallback;
    return parsed;
}
