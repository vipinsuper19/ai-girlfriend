import {
    Body,
    Controller,
    Get,
    HttpCode,
    Post,
    UseGuards,
} from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator.js';

import { AuthService } from './auth.service.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { ChangeEmailDto } from '../dto/change-email.dto.js';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { ForgotPasswordDto } from '../dto/forgot-password.dto.js';
import { GoogleLoginDto } from '../dto/google-login.dto.js';
import { CheckResetTokenDto, ResetPasswordDto } from '../dto/reset-password.dto.js';
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

    @Public()
    @Post('google')
    google(
        @Body() dto: GoogleLoginDto,
    ) {
        return this.authService.googleLogin(dto.idToken);
    }

    @Public()
    @Post('password/forgot')
    @HttpCode(200)
    forgotPassword(
        @Body() dto: ForgotPasswordDto,
    ) {
        return this.authService.forgotPassword(dto.email);
    }

    @Public()
    @Post('password/reset/check')
    @HttpCode(200)
    checkResetToken(
        @Body() dto: CheckResetTokenDto,
    ) {
        return this.authService.checkResetToken(dto.token);
    }

    @Public()
    @Post('password/reset')
    @HttpCode(200)
    resetPassword(
        @Body() dto: ResetPasswordDto,
    ) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @Post('email')
    @UseGuards(JwtAuthGuard)
    changeEmail(
        @CurrentUser() user: JwtPayload,
        @Body() dto: ChangeEmailDto,
    ) {
        return this.authService.changeEmail(
            String(user.sub),
            String(user.sessionId),
            dto.password,
            dto.newEmail,
        );
    }

    @Post('password')
    @UseGuards(JwtAuthGuard)
    changePassword(
        @CurrentUser() user: JwtPayload,
        @Body() dto: ChangePasswordDto,
    ) {
        return this.authService.changePassword(
            String(user.sub),
            String(user.sessionId),
            dto.currentPassword,
            dto.newPassword,
        );
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

    @Public()
    @Post('refresh')
    async refresh(@Body() dto: RefreshTokenDto) {
        return this.authService.refresh(dto.refreshToken);
    }
}