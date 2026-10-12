import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { StorageService } from './storage.service.js';

@Injectable()
export class SignedUrlInterceptor implements NestInterceptor {
    constructor(private readonly storage: StorageService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(
            mergeMap(async (data) => {
                if (context.getType() !== 'http') return data;
                return this.storage.signFileUrls(data);
            }),
        );
    }
}
