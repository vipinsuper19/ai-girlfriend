import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';

@Global()
@Module({
    imports: [
        JwtModule.register({}),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtAuthGuard
    ],
    exports: [
        AuthService,
        JwtModule,
        JwtAuthGuard,
    ],
})
export class AuthModule { }
