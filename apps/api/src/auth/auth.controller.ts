import {
    Body,
    Controller,
    Get,
    Post,
    UseGuards,
} from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator.js';

import { AuthService } from './auth.service.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { LoginDto } from '../dto/login.dto.js';
import { RegisterDto } from '../dto/register.dto.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { RefreshTokenDto } from '../dto/refresh-token.dto.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    @Public()
    @Post('register')
    register(
        @Body() dto: RegisterDto,
    ) {
        return this.authService.register(dto);
    }

    @Public()
    @Post('login')
    login(
        @Body() dto: LoginDto,
    ) {
        return this.authService.login(dto);
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    async logout(@CurrentUser() user: JwtPayload) {
        return this.authService.logout(
            String(user.sub),
            String(user.sessionId),
        );
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    me(
        @CurrentUser() user: JwtPayload,
    ) {
        return this.authService.me(user.sub);
    }

    @Post('refresh')
    async refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refresh(dto.refreshToken);
    }
}