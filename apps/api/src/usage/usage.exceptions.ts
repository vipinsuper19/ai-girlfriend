import { ForbiddenException } from '@nestjs/common';

export type UsageLimitDetails = {
    period?: string;
    resetsAt?: string;
};

export class UsageLimitExceededException extends ForbiddenException {
    constructor(
        public readonly feature: string,
        public readonly limit: number,
        public readonly used: number,
        public readonly requested: number,
        details: UsageLimitDetails = {},
    ) {
        const period = details.period;
        const message = period === 'day'
            ? `Free tier daily limit reached for ${feature}`
            : `Usage limit exceeded for ${feature}`;

        super({
            code: 'USAGE_LIMIT_EXCEEDED',
            message,
            feature,
            limit,
            used,
            requested,
            remaining: Math.max(0, limit - used),
            ...(period ? { period } : {}),
            ...(details.resetsAt ? { resetsAt: details.resetsAt } : {}),
        });
    }
}
