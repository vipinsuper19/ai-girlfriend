import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import { sessionIsLive } from '../auth/session-state.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
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

        let payload: JwtPayload;
        try {
            payload =
                await this.jwtService.verifyAsync<JwtPayload>(token, {
                    secret: process.env['JWT_ACCESS_SECRET'],
                });
        } catch {
            throw new UnauthorizedException(
                'Invalid or expired access token',
            );
        }

        const sessionId = Number(payload.sessionId);
        const session = Number.isInteger(sessionId) && sessionId > 0
            ? await (this.prisma.client as any).orm.public.Session
                .where({ id: sessionId })
                .first()
            : null;

        if (!sessionIsLive(session, payload.sub, new Date())) {
            throw new UnauthorizedException(
                'Session has ended',
            );
        }

        request.user = payload;
        return true;
    }
}
