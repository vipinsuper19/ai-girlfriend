import { Module } from '@nestjs/common';

import { UsageModule } from '../usage/usage.module.js';
import { IMAGE_PROVIDER } from './image.provider.js';
import { ImagesController } from './images.controller.js';
import { ImagesService } from './images.service.js';
import { GeminiImageProvider } from './providers/gemini-image.provider.js';

@Module({
    imports: [UsageModule],
    controllers: [ImagesController],
    providers: [
        ImagesService,
        GeminiImageProvider,
        {
            provide: IMAGE_PROVIDER,
            useExisting: GeminiImageProvider,
        },
    ],
})
export class ImagesModule { }
