import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const isPublic =
            this.reflector.getAllAndOverride<boolean>(
                IS_PUBLIC_KEY,
                [
                    context.getHandler(),
                    context.getClass(),
                ],
            );

        if (isPublic) {
            return true;
        }

        const request = context
            .switchToHttp()
            .getRequest();

        const authorization =
            request.headers.authorization;

        if (!authorization) {
            throw new UnauthorizedException(
                'Authorization token is required',
            );
        }

        const [type, token] =
            authorization.split(' ');

        if (type !== 'Bearer' || !token) {
            throw new UnauthorizedException(
                'Invalid authorization header',
            );
        }

        try {
            request.user =
                await this.jwtService.verifyAsync(token, {
                    secret: process.env['JWT_ACCESS_SECRET'],
                });

            return true;
        } catch {
            throw new UnauthorizedException(
                'Invalid or expired access token',
            );
        }
    }
}