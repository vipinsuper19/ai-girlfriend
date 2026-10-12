import { Module } from '@nestjs/common';

import {
    CONTENT_MODERATOR,
    SAFETY_CONFIG,
    type ContentModerator,
} from './content-moderator.js';
import { createContentModerator } from './moderation.factory.js';
import { ModerationService } from './moderation.service.js';
import { safetyConfigFromEnv, type SafetyConfig } from './safety.config.js';

@Module({
    providers: [
        {
            provide: SAFETY_CONFIG,
            useFactory: () => safetyConfigFromEnv(),
        },
        {
            provide: CONTENT_MODERATOR,
            inject: [SAFETY_CONFIG],
            useFactory: (config: SafetyConfig) =>
                createContentModerator(config, process.env),
        },
        {
            provide: ModerationService,
            inject: [SAFETY_CONFIG, CONTENT_MODERATOR],
            useFactory: (config: SafetyConfig, provider: ContentModerator) =>
                new ModerationService(config, provider),
        },
    ],
    exports: [ModerationService],
})
export class ModerationModule {}
