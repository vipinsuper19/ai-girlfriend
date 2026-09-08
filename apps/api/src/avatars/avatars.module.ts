import { Module } from '@nestjs/common';

import { AvatarsController } from './avatars.controller.js';
import { AvatarsService } from './avatars.service.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [StorageModule],
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