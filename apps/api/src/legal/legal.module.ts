import { Module } from '@nestjs/common';

import { MailModule } from '../mail/mail.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import {
    DELETION_REQUEST_STORE,
    PrismaDeletionRequestStore,
} from './deletion-request.store.js';
import { DeletionRequestsService } from './deletion-requests.service.js';
import { LegalController } from './legal.controller.js';
import { SlidingWindowLimiter } from './rate-limit.js';

const HOUR_MS = 60 * 60 * 1000;
const REQUESTS_PER_HOUR = 5;

@Module({
    imports: [MailModule, PrismaModule],
    controllers: [LegalController],
    providers: [
        DeletionRequestsService,
        {
            provide: DELETION_REQUEST_STORE,
            useClass: PrismaDeletionRequestStore,
        },
        {
            provide: SlidingWindowLimiter,
            useFactory: () => new SlidingWindowLimiter(REQUESTS_PER_HOUR, HOUR_MS),
        },
    ],
})
export class LegalModule {}
