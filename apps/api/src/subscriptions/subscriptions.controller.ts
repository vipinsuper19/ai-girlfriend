import {
    Body,
    Controller,
    Get,
    Post,
    UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { GooglePlayPurchaseDto } from './dto/google-play-purchase.dto.js';
import { GooglePlayService } from './google-play.service.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
    constructor(
        private readonly subscriptionsService: SubscriptionsService,
        private readonly googlePlay: GooglePlayService,
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

    @Get('google-play')
    googlePlayConfig(@CurrentUser() user: JwtPayload) {
        return this.googlePlay.config(Number(user.sub));
    }

    @Post('google-play')
    verifyGooglePlay(
        @CurrentUser() user: JwtPayload,
        @Body() dto: GooglePlayPurchaseDto,
    ) {
        return this.googlePlay.verify(Number(user.sub), dto);
    }
}
