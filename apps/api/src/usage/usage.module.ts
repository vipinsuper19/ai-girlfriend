import {
    Module,
} from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';

import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';

@Module({
    imports: [
        PrismaModule,
        SubscriptionsModule,
    ],
    controllers: [
        UsageController,
    ],
    providers: [
        UsageService,
    ],
    exports: [
        UsageService,
    ],
})
export class UsageModule {}
