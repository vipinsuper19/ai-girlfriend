import { Module } from '@nestjs/common';

import { AvatarsController } from './avatars.controller.js';
import { AvatarsService } from './avatars.service.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [StorageModule, ModerationModule],
  controllers: [
    AvatarsController,
  ],
  providers: [
    AvatarsService,
  ],
  exports: [
    AvatarsService,
  ],
})
export class AvatarsModule { }