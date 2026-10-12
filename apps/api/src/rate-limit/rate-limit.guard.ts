import {
    CanActivate,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { clientIp } from './client-ip.js';
import { RATE_LIMIT_KEY } from './rate-limit.decorator.js';
import type { RateLimitRoute } from './rate-limit.config.js';
import { RateLimitService } from './rate-limit.service.js';
import { rateLimitSubject } from './subject-key.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly rateLimits: RateLimitService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const route = this.reflector.getAllAndOverride<RateLimitRoute | undefined>(
            RATE_LIMIT_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!route) return true;

        const request = context.switchToHttp().getRequest();
        this.rateLimits.enforce(
            route,
            clientIp(request),
            rateLimitSubject(request),
        );
        return true;
    }
}
