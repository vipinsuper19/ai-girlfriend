import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
} from '@nestjs/common';

/** Enough for a person to flag several replies, tight enough to stop a script. */
export const REPORT_THROTTLE_LIMIT = 10;
export const REPORT_THROTTLE_WINDOW_MS = 60_000;

export function takeReportSlot(
    hits: number[],
    now: number,
    limit = REPORT_THROTTLE_LIMIT,
    windowMs = REPORT_THROTTLE_WINDOW_MS,
): { allowed: boolean; hits: number[] } {
    const recent = hits.filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
        return { allowed: false, hits: recent };
    }
    recent.push(now);
    return { allowed: true, hits: recent };
}

/**
 * Per-user limit for POST /reports. The map lives in this process, so each
 * API instance counts on its own.
 */
@Injectable()
export class ReportThrottleGuard implements CanActivate {
    private readonly hits = new Map<string, number[]>();

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const userId = String(request.user?.sub ?? '');
        if (!userId) {
            throw new HttpException('Too many reports', HttpStatus.TOO_MANY_REQUESTS);
        }

        const decision = takeReportSlot(this.hits.get(userId) ?? [], Date.now());
        this.hits.set(userId, decision.hits);
        if (!decision.allowed) {
            throw new HttpException('Too many reports', HttpStatus.TOO_MANY_REQUESTS);
        }
        return true;
    }
}
