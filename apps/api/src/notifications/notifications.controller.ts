import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { RegisterDeviceDto } from './dto/register-device.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) { }

    @Get('status')
    status() {
        return this.notifications.status();
    }

    @Post('devices')
    register(
        @CurrentUser() user: JwtPayload,
        @Body() dto: RegisterDeviceDto,
    ) {
        return this.notifications.registerDevice(Number(user.sub), dto);
    }

    @Delete('devices/:token')
    remove(
        @CurrentUser() user: JwtPayload,
        @Param('token') token: string,
    ) {
        return this.notifications.removeDevice(Number(user.sub), token);
    }

    @Post('test')
    @HttpCode(200)
    test(@CurrentUser() user: JwtPayload) {
        return this.notifications.sendTest(Number(user.sub));
    }
}
