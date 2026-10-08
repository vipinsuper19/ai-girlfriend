import { UsageFeatureDto } from './dto/record-usage.dto.js';

export type UsageLimit = number | null;

export type SubscriptionPlan =
    | 'FREE'
    | 'PREMIUM'
    | 'PREMIUM_PLUS';

/**
 * Initial MVP limits.
 *
 * The PRD defines the plans qualitatively ("limited", "more/unlimited")
 * but does not specify numeric quotas. These values are therefore
 * explicit product defaults and should be moved to admin/configuration
 * once the commercial limits are finalized.
 *
 * null means unlimited.
 */
export const USAGE_LIMITS: Record<
    SubscriptionPlan,
    Partial<Record<UsageFeatureDto, UsageLimit>>
> = {
    FREE: {
        MESSAGES: 100,
        TEXT_TOKENS: 100_000,
        IMAGE_GENERATIONS: 5,
        VOICE_MINUTES: 10,
        AUDIO_CALL_MINUTES: 0,
        VIDEO_CALL_MINUTES: 0,
    },

    PREMIUM: {
        MESSAGES: null,
        TEXT_TOKENS: 1_000_000,
        IMAGE_GENERATIONS: 100,
        VOICE_MINUTES: 300,
        AUDIO_CALL_MINUTES: 1_200,
        VIDEO_CALL_MINUTES: 0,
    },

    PREMIUM_PLUS: {
        MESSAGES: null,
        TEXT_TOKENS: null,
        IMAGE_GENERATIONS: 300,
        VOICE_MINUTES: 1_000,
        AUDIO_CALL_MINUTES: 1_200,
        VIDEO_CALL_MINUTES: 1_200,
    },
};
