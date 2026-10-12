import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitedException extends HttpException {
    constructor(retryAfterSeconds: number) {
        const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
        super(
            {
                statusCode: HttpStatus.TOO_MANY_REQUESTS,
                message: 'Too many requests. Try again later.',
                error: 'Too Many Requests',
                code: 'RATE_LIMITED',
                retryAfterSeconds: seconds,
            },
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }
}
