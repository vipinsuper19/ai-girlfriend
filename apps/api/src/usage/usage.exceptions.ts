import { ForbiddenException } from '@nestjs/common';

export class UsageLimitExceededException extends ForbiddenException {
    constructor(
        public readonly feature: string,
        public readonly limit: number,
        public readonly used: number,
        public readonly requested: number,
    ) {
        super({
            code: 'USAGE_LIMIT_EXCEEDED',
            message: `Usage limit exceeded for ${feature}`,
            feature,
            limit,
            used,
            requested,
            remaining: Math.max(0, limit - used),
        });
    }
}
