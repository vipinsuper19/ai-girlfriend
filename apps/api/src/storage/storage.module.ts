import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { createObjectStorage } from './create-storage.js';
import { OBJECT_STORAGE } from './object-storage.js';
import { SignedUrlInterceptor } from './signed-url.interceptor.js';
import { StorageCleanup } from './storage-cleanup.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({
    providers: [
        {
            provide: OBJECT_STORAGE,
            useFactory: () => createObjectStorage(process.env),
        },
        StorageCleanup,
        StorageService,
        {
            provide: APP_INTERCEPTOR,
            useClass: SignedUrlInterceptor,
        },
    ],
    exports: [StorageService, StorageCleanup],
})
export class StorageModule {}
