import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { MemoriesModule } from '../memories/memories.module.js';
import { UsageModule } from '../usage/usage.module.js';

@Module({
  imports: [AiModule, MemoriesModule, UsageModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule { }