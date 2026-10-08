import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { CommonModule } from './common/common.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AvatarsModule } from './avatars/avatars.module.js';
import { StorageModule } from './storage/storage.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { AiModule } from './ai/ai.module.js';
import { MemoriesModule } from './memories/memories.module.js';
import { VoiceModule } from './voice/voice.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { UsageModule } from "./usage/usage.module.js";
import { MailModule } from './mail/mail.module.js';
import { ImagesModule } from './images/images.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
@Module({
  imports: [
    CommonModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    AvatarsModule,
    StorageModule,
    ConversationsModule,
    MessagesModule,
    AiModule,
    MemoriesModule,
    VoiceModule,
    SubscriptionsModule,
    UsageModule,
    MailModule,
    ImagesModule,
    NotificationsModule,
  ],
})
export class AppModule { }