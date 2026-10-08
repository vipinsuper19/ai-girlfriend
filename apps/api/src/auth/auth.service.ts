import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';

import { accessTokenExpiresIn } from './access-token.js';
import { passwordChangeProblem } from './password-change.js';
import { accountCanSignIn, sessionExpired } from './session-state.js';
import {
    googleDisplayName,
    googleIdentity,
    googleSignInPlan,
} from './google-identity.js';
import { GoogleTokenService } from './google-token.service.js';
import {
    normalizeEmail,
    passwordFingerprint,
    RESET_AUDIENCE,
    RESET_TTL,
    resetLink,
    resetMail,
    resetSecret,
} from './password-reset.js';
import { MailService } from '../mail/mail.service.js';
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

const RESET_MAIL_GAP_MS = 60_000;

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly lastResetMail = new Map<string, number>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly mail: MailService,
        private readonly googleTokens: GoogleTokenService,
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

        if (!user?.passwordHash || !accountCanSignIn(user.status)) {
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

        if (sessionExpired(session.expiresAt, new Date())) {
            await db.orm.public.Session.where({
                id: session.id,
            }).delete();

            throw new UnauthorizedException('Refresh token has expired');
        }

        const user = await db.orm.public.User.where({
            id: payload.sub,
        }).first();

        if (!user || !accountCanSignIn(user.status)) {
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

    async changePassword(
        userId: string,
        sessionId: string,
        currentPassword: string,
        newPassword: string,
    ) {
        const db = this.prisma.client as any;
        const user = await db.orm.public.User.where({
            id: userId,
        }).first();

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        const currentMatches = user.passwordHash
            ? await bcrypt.compare(currentPassword, user.passwordHash)
            : false;
        const problem = passwordChangeProblem(currentPassword, newPassword, {
            hasPassword: Boolean(user.passwordHash),
            currentMatches,
        });

        if (problem) {
            throw new BadRequestException(problem);
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);

        await db.orm.public.User.where({
            id: userId,
        }).update({
            passwordHash,
        });

        const sessions = await db.orm.public.Session.where({
            userId,
        }).all();

        for (const session of sessions) {
            if (String(session.id) !== sessionId) {
                await db.orm.public.Session.where({
                    id: session.id,
                }).delete();
            }
        }

        return {
            message: 'Password updated',
        };
    }

    /** Always answers the same way, so it does not reveal which emails exist. */
    async forgotPassword(email: string) {
        const db = this.prisma.client as any;
        const normalized = normalizeEmail(email);
        const reply = {
            message: 'If that email has an account, a reset link is on its way.',
        };

        const last = this.lastResetMail.get(normalized) ?? 0;
        if (Date.now() - last < RESET_MAIL_GAP_MS) {
            return reply;
        }

        const user = await db.orm.public.User
            .where({ email: normalized })
            .first();

        if (!user?.passwordHash || !accountCanSignIn(user.status)) {
            return reply;
        }

        const secret = resetSecret();
        if (!secret) {
            this.logger.error('No secret is set for password reset tokens');
            return reply;
        }

        const token = await this.jwtService.signAsync(
            {
                sub: String(user.id),
                fp: passwordFingerprint(user.passwordHash),
            },
            {
                secret,
                audience: RESET_AUDIENCE,
                expiresIn: RESET_TTL,
            },
        );

        this.lastResetMail.set(normalized, Date.now());
        await this.mail
            .send({ to: user.email, ...resetMail(resetLink(token)) })
            .catch((error: unknown) => {
                this.logger.error(
                    'Reset mail failed',
                    error instanceof Error ? error.stack : String(error),
                );
            });

        return reply;
    }

    async resetPassword(token: string, newPassword: string) {
        const db = this.prisma.client as any;
        const secret = resetSecret();
        const invalid = new BadRequestException(
            'This reset link has expired or was already used.',
        );

        if (!secret) {
            throw invalid;
        }

        let payload: { sub?: string; fp?: string };
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret,
                audience: RESET_AUDIENCE,
            });
        } catch {
            throw invalid;
        }

        const user = await db.orm.public.User
            .where({ id: Number(payload.sub) })
            .first();

        if (
            !user?.passwordHash ||
            !accountCanSignIn(user.status) ||
            payload.fp !== passwordFingerprint(user.passwordHash)
        ) {
            throw invalid;
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await db.orm.public.User
            .where({ id: user.id })
            .update({ passwordHash });

        const sessions = await db.orm.public.Session
            .where({ userId: user.id })
            .all();
        for (const session of sessions) {
            await db.orm.public.Session.where({ id: session.id }).delete();
        }

        return {
            message: 'Password updated. Sign in with the new one.',
        };
    }

    async changeEmail(
        userId: string,
        sessionId: string,
        password: string,
        newEmail: string,
    ) {
        const db = this.prisma.client as any;
        const user = await db.orm.public.User
            .where({ id: Number(userId) })
            .first();

        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        if (!user.passwordHash) {
            throw new BadRequestException(
                'This account signs in with Google, so its email comes from Google.',
            );
        }
        if (!(await bcrypt.compare(password, user.passwordHash))) {
            throw new BadRequestException('Your password is incorrect.');
        }

        const email = normalizeEmail(newEmail);
        if (email === user.email) {
            throw new BadRequestException('That is already your email.');
        }

        const taken = await db.orm.public.User.where({ email }).first();
        if (taken) {
            throw new ConflictException('That email already has an account.');
        }

        const updated = await db.orm.public.User
            .where({ id: user.id })
            .update({ email });

        const sessions = await db.orm.public.Session
            .where({ userId: user.id })
            .all();
        for (const session of sessions) {
            if (String(session.id) !== sessionId) {
                await db.orm.public.Session.where({ id: session.id }).delete();
            }
        }

        await this.mail
            .send({
                to: user.email,
                subject: 'Your email was changed',
                text: `The email on your account is now ${email}. If you did not do this, reset your password from the sign-in page.`,
            })
            .catch(() => undefined);

        return {
            id: updated.id,
            email: updated.email,
            displayName: updated.displayName,
        };
    }

    async googleLogin(idToken: string) {
        const db = this.prisma.client as any;
        const claims = await this.googleTokens.verify(idToken);
        const { identity, problem } = googleIdentity(claims);

        if (!identity) {
            throw new UnauthorizedException(problem);
        }

        const account = await db.orm.public.Account
            .where({ provider: 'GOOGLE', providerAccountId: identity.googleId })
            .first();
        const emailOwner = account
            ? null
            : await db.orm.public.User.where({ email: identity.email }).first();

        const plan = googleSignInPlan(account?.userId, emailOwner?.id);

        if (plan.kind === 'conflict') {
            throw new ConflictException(
                'This email already has an account. Sign in with its password.',
            );
        }

        let user;
        if (plan.kind === 'existing') {
            user = await db.orm.public.User.where({ id: plan.userId }).first();
        } else {
            user = await db.orm.public.User.create({
                email: identity.email,
                displayName: googleDisplayName(identity),
                passwordHash: null,
            });
            await db.orm.public.Account.create({
                userId: user.id,
                provider: 'GOOGLE',
                providerAccountId: identity.googleId,
                providerData: { email: identity.email },
            });
        }

        if (!user || !accountCanSignIn(user.status)) {
            throw new UnauthorizedException('This account cannot sign in');
        }

        return this.createAuthResponse(user as UserRecord);
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