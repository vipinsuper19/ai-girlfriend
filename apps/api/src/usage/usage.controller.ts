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

import { UsageService } from './usage.service.js';
import { CheckUsageDto } from './dto/check-usage.dto.js';
import { RecordUsageDto } from './dto/record-usage.dto.js';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
    constructor(
        private readonly usageService: UsageService,
    ) { }

    @Get('summary')
    async summary(@CurrentUser() user: JwtPayload) {
        return this.usageService.getSummary(
            Number(user.sub),
        );
    }

    @Post('check')
    async check(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CheckUsageDto,
    ) {
        return this.usageService.check(
            Number(user.sub),
            dto.feature,
            dto.quantity,
        );
    }

    @Post()
    async record(
        @CurrentUser() user: JwtPayload,
        @Body() dto: RecordUsageDto,
    ) {
        return this.usageService.record(
            Number(user.sub),
            dto,
        );
    }
}
