import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { ApiResponse } from '../interfaces/api-response.interface.js';

@Injectable()
export class ResponseInterceptor<T>
    implements NestInterceptor<T, ApiResponse<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler<T>,
    ): Observable<ApiResponse<T>> {
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