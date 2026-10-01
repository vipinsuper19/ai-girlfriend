import {
    Controller,
    Get,
    UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
    constructor(
        private readonly subscriptionsService: SubscriptionsService,
    ) { }

    @Get('current')
    async current(@CurrentUser() user: JwtPayload) {
        return this.subscriptionsService.getCurrent(
            Number(user.sub),
        );
    }

    @Get('latest')
    async latest(@CurrentUser() user: JwtPayload) {
        return this.subscriptionsService.getLatest(
            Number(user.sub),
        );
    }
}
