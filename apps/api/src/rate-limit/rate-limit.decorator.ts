import { SetMetadata } from '@nestjs/common';

import type { RateLimitRoute } from './rate-limit.config.js';

export const RATE_LIMIT_KEY = 'rate_limit_route';

export const RateLimit = (route: RateLimitRoute) =>
    SetMetadata(RATE_LIMIT_KEY, route);
