import {
    Injectable,
    Logger,
    NestMiddleware,
} from '@nestjs/common';
import type {
    NextFunction,
    Request,
    Response,
} from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger(RequestLoggerMiddleware.name);

    use(
        request: Request,
        response: Response,
        next: NextFunction,
    ): void {
        const startedAt = Date.now();

        response.on('finish', () => {
            const duration = Date.now() - startedAt;

            this.logger.log(
                `${request.method} ${request.originalUrl ?? request.url} ` +
                `${response.statusCode} ${duration}ms`,
            );
        });

        next();

    }
}