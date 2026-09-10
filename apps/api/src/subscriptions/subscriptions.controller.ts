import {
    Controller,
    Get,
    Req,
} from '@nestjs/common';

import { SubscriptionsService } from './subscriptions.service.js';

@Controller('subscriptions')
export class SubscriptionsController {
    constructor(
        private readonly subscriptionsService: SubscriptionsService,
    ) { }

    @Get('current')
    async current(@Req() request: any) {
        const userId = Number(request.user?.sub);

        return this.subscriptionsService.getCurrent(
            userId,
        );
    }

    @Get('latest')
    async latest(@Req() request: any) {
        const userId = Number(request.user?.sub);

        return this.subscriptionsService.getLatest(
            userId,
        );
    }
}
