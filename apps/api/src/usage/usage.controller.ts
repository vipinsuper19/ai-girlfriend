import {
    Body,
    Controller,
    Get,
    Post,
    Req,
} from '@nestjs/common';

import { UsageService } from './usage.service.js';
import { CheckUsageDto } from './dto/check-usage.dto.js';
import { RecordUsageDto } from './dto/record-usage.dto.js';

@Controller('usage')
export class UsageController {
    constructor(
        private readonly usageService: UsageService,
    ) { }

    @Get('summary')
    async summary(@Req() req: any) {
        return this.usageService.getSummary(
            req.user.id,
        );
    }

    @Post('check')
    async check(
        @Req() req: any,
        @Body() dto: CheckUsageDto,
    ) {
        return this.usageService.check(
            req.user.id,
            dto.feature,
            dto.quantity,
        );
    }

    /**
     * Internal/admin-facing usage endpoint should normally be protected
     * by an appropriate role/permission guard in the application's
     * existing auth layer.
     */
    @Post()
    async record(
        @Req() req: any,
        @Body() dto: RecordUsageDto,
    ) {
        return this.usageService.record(
            req.user.id,
            dto,
        );
    }
}
