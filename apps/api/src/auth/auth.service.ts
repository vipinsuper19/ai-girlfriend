import {
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';

import { accessTokenExpiresIn } from './access-token.js';
import type { LoginDto } from '../dto/login.dto.js';
import type { RegisterDto } from '../dto/register.dto.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

type UserRecord = {
    id: string | number;
    email: string;
    displayName: string;
    passwordHash: string | null;
    createdAt: Date;
};

type SessionRecord = {
    id: string | number;
};

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async register(dto: RegisterDto) {
        const db = this.prisma.client as any;

        const email = dto.email.toLowerCase().trim();

        const existingUser = await db.orm.public.User
            .where({
                email,
            })
            .first();

        if (existingUser) {
            throw new ConflictException('Email is already registered');
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);

        const user = await db.orm.public.User.create(
            {
                email,
                displayName: dto.displayName.trim(),
                passwordHash,
            });

        return this.createAuthResponse(user as UserRecord);

    }

    async login(dto: LoginDto) {
        const db = this.prisma.client as any;

        const email = dto.email.toLowerCase().trim();

        const user = await db.orm.public.User
            .where({
                email,
            })
            .first();

        if (!user?.passwordHash) {
            throw new UnauthorizedException(
                'Invalid email or password',
            );
        }

        const isPasswordValid = await bcrypt.compare(
            dto.password,
            user.passwordHash,
        );

        if (!isPasswordValid) {
            throw new UnauthorizedException(
                'Invalid email or password',
            );
        }

        return this.createAuthResponse(user as UserRecord);

    }


    async refresh(refreshToken: string) {
        let payload: JwtPayload;
        const db = this.prisma.client as any;
        try {
            payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
                secret: process.env['JWT_REFRESH_SECRET'],
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }


        const session = await db.orm.public.Session.where({
            id: payload.sessionId,
            userId: payload.sub,
        }).first();

        if (!session || session.refreshToken !== refreshToken) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (session.expiresAt <= new Date()) {
            await db.orm.public.Session.where({
                id: session.id,
            }).delete();

            throw new UnauthorizedException('Refresh token has expired');
        }

        const user = await db.orm.public.User.where({
            id: payload.sub,
        }).first();

        if (!user) {
            await db.orm.public.Session.where({
                id: session.id,
            }).delete();

            throw new UnauthorizedException('User not found');
        }

        const accessExpiresIn = accessTokenExpiresIn() as StringValue;

        const refreshExpiresIn = (
            process.env['JWT_REFRESH_EXPIRES_IN'] ?? '30d'
        ) as StringValue;

        const newPayload: JwtPayload = {
            sub: String(user.id),
            email: user.email,
            sessionId: String(session.id),
        };

        const accessToken = await this.jwtService.signAsync(newPayload, {
            secret: process.env['JWT_ACCESS_SECRET'],
            expiresIn: accessExpiresIn,
        });

        const newRefreshToken = await this.jwtService.signAsync(newPayload, {
            secret: process.env['JWT_REFRESH_SECRET'],
            expiresIn: refreshExpiresIn,
        });

        const newExpiresAt = this.getExpiryDate(
            process.env['JWT_REFRESH_EXPIRES_IN'] ?? '30d',
        );

        await db.orm.public.Session.where({
            id: session.id,
        }).update({
            refreshToken: newRefreshToken,
            expiresAt: newExpiresAt,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
            },
            accessToken,
            refreshToken: newRefreshToken,
        };
    }

    async me(userId: string) {
        const db = this.prisma.client as any;

        const user = await db.orm.public.User.where({
            id: userId,
        }).first();

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt,
        };

    }

    async logout(userId: string, sessionId: string) {
        const db = this.prisma.client as any;

        const session = await db.orm.public.Session.where({
            id: sessionId,
            userId,
        }).first();

        if (!session) {
            return {
                message: 'Logged out successfully',
            };
        }

        await db.orm.public.Session.where({
            id: sessionId,
        }).delete();

        return {
            message: 'Logged out successfully',
        };

    }

    private async createAuthResponse(user: UserRecord) {

        const db = this.prisma.client as any;

        const expiresAt = this.getExpiryDate(
            process.env['JWT_REFRESH_EXPIRES_IN'] ?? '30d',
        );

        const session = await db.orm.public.Session.create({
            userId: user.id,
            refreshToken: '',
            expiresAt,
        });

        return this.generateTokensForSession(user, session.id, true);
    }

    private async generateTokensForSession(
        user: UserRecord,
        sessionId: string,
        rotateRefreshToken = false,
    ) {

        const db = this.prisma.client as any;


        const accessExpiresIn = accessTokenExpiresIn() as StringValue;

        const refreshExpiresIn = (
            process.env['JWT_REFRESH_EXPIRES_IN'] ?? '30d'
        ) as StringValue;

        const payload: JwtPayload = {
            sub: String(user.id),
            email: user.email,
            sessionId: String(sessionId),
        };

        const accessToken = await this.jwtService.signAsync(payload, {
            secret: process.env['JWT_ACCESS_SECRET'],
            expiresIn: accessExpiresIn,
        });

        const refreshToken = await this.jwtService.signAsync(payload, {
            secret: process.env['JWT_REFRESH_SECRET'],
            expiresIn: refreshExpiresIn,
        });

        if (rotateRefreshToken) {
            await db.orm.public.Session.where({
                id: sessionId,
            }).update({
                refreshToken,
            });
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
            },
            accessToken,
            refreshToken,
        };
    }

    private getExpiryDate(expiresIn: string): Date {
        const match = /^(\d+)([smhd])$/.exec(expiresIn);

        if (!match) {
            throw new Error(
                `Invalid JWT_REFRESH_EXPIRES_IN value: ${expiresIn}`,
            );
        }

        const value = Number(match[1]);
        const unit = match[2];

        const millisecondsByUnit: Record<string, number> = {
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
        };

        return new Date(
            Date.now() + value * millisecondsByUnit[unit],
        );

    }
}