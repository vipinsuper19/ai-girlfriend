import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { RequestLoggerMiddleware } from './middleware/request-logger.middleware.js';

@Module({})
export class CommonModule implements NestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggerMiddleware).forRoutes('{*path}');
    }
}
