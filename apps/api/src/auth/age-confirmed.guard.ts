import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const AGE_REQUIRED = 'AGE_REQUIRED';

export class AgeRequiredException extends ForbiddenException {
    constructor() {
        super({
            code: AGE_REQUIRED,
            message: 'Confirm you are 18 or older before continuing.',
        });
    }
}

/**
 * Chat and companion creation stay closed until `PATCH /users/me/age` has
 * stored `user.ageConfirmedAt`. Auth and account routes do not use this guard.
 */
@Injectable()
export class AgeConfirmedGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
        const id = Number(request.user?.sub);
        const row = Number.isInteger(id) && id > 0
            ? await (this.prisma.client as any).orm.public.User
                .where({ id })
                .first()
            : null;
        if (!ageIsConfirmed(row?.ageConfirmedAt)) {
            throw new AgeRequiredException();
        }
        return true;
    }
}

export function ageIsConfirmed(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}
