import { Injectable } from '@nestjs/common';

import { MemoryRateLimitStore } from './memory-rate-limit.store.js';
import { rateLimitConfig, type RateLimitRoute } from './rate-limit.config.js';
import { RateLimitedException } from './rate-limit.exception.js';

@Injectable()
export class RateLimitService {
    private readonly store = new MemoryRateLimitStore();

    enforce(
        route: RateLimitRoute,
        ip: string,
        subject: string | null,
        now = Date.now(),
    ): void {
        const config = rateLimitConfig()[route];
        const checks = [{
            key: `${route}:ip:${ip}`,
            max: config.ip.max,
            windowMs: config.ip.windowMs,
        }];
        if (subject) {
            checks.push({
                key: `${route}:user:${subject}`,
                max: config.user.max,
                windowMs: config.user.windowMs,
            });
        }

        const decision = this.store.consume(checks, now);
        if (!decision.allowed) {
            throw new RateLimitedException(decision.retryAfterSeconds);
        }
    }
}
