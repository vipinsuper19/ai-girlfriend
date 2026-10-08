import {
    Body,
    Controller,
    Delete,
    Get,
    Patch,
    UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
    ) { }

    @Get('me')
    async getMe(@CurrentUser() user: JwtPayload) {
        return this.usersService.findMe(
            String(user.sub),
        );
    }

    @Get('me/export')
    async exportMe(@CurrentUser() user: JwtPayload) {
        return this.usersService.exportMe(
            String(user.sub),
        );
    }

    @Patch('me')
    async updateMe(
        @CurrentUser() user: JwtPayload,
        @Body() dto: UpdateUserDto,
    ) {
        return this.usersService.updateMe(
            String(user.sub),
            dto,
        );
    }

    @Delete('me')
    async deleteMe(
        @CurrentUser() user: JwtPayload,
    ) {
        return this.usersService.deleteMe(
            String(user.sub),
        );
    }
}