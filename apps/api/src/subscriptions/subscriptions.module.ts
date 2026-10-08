import { Module } from '@nestjs/common';

import { SubscriptionsController } from './subscriptions.controller.js';
import { GooglePlayService } from './google-play.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
    controllers: [SubscriptionsController],
    providers: [SubscriptionsService, GooglePlayService],
    exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
