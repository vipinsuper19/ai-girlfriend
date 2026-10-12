import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Inject,
    Injectable,
    Optional,
} from '@nestjs/common';

import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Not registered. The guard reads AGE_GATE_ENFORCED when this is omitted. */
export const AGE_GATE_FLAG = Symbol('AGE_GATE_FLAG');

const AGE_GATE_ON = new Set(['true', 'yes', 'on', '1']);

/** Default off, so clients that never call PATCH /users/me/age keep working. */
export function ageGateEnforced(
    value: unknown = process.env['AGE_GATE_ENFORCED'],
): boolean {
    if (value === true) return true;
    if (typeof value !== 'string') return false;
    return AGE_GATE_ON.has(value.trim().toLowerCase());
}

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
 * When `AGE_GATE_ENFORCED` is true, chat and companion creation stay closed
 * until `PATCH /users/me/age` has stored `user.ageConfirmedAt`. The default
 * is off, so the guard allows the request. Auth and account routes do not
 * use this guard.
 */
@Injectable()
export class AgeConfirmedGuard implements CanActivate {
    private readonly enforced: boolean;

    constructor(
        private readonly prisma: PrismaService,
        @Optional()
        @Inject(AGE_GATE_FLAG)
        enforced?: boolean,
    ) {
        this.enforced = typeof enforced === 'boolean' ? enforced : ageGateEnforced();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (!this.enforced) return true;
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
