import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RAW_HTML_KEY } from '../decorators/raw-html.decorator.js';
import type { ApiResponse } from '../interfaces/api-response.interface.js';

@Injectable()
export class ResponseInterceptor<T>
    implements NestInterceptor<T, ApiResponse<T> | T> {
    constructor(private readonly reflector?: Reflector) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler<T>,
    ): Observable<ApiResponse<T> | T> {
        const rawHtml = this.reflector?.getAllAndOverride<boolean>(
            RAW_HTML_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (rawHtml) {
            return next.handle();
        }

        return next.handle().pipe(
            map((data) => {
                const response = context.switchToHttp().getResponse();
                const request = context.switchToHttp().getRequest();

                return {
                    success: true,
                    statusCode: response.statusCode,
                    message: 'Request successful',
                    data,
                    timestamp: new Date().toISOString(),
                    path: request.originalUrl ?? request.url,
                };
            }),
        );

    }
}