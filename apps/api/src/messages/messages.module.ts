import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { MemoriesModule } from '../memories/memories.module.js';

@Module({
  imports: [AiModule, MemoriesModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule { }