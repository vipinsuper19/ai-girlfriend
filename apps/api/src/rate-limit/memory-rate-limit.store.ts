export type RateLimitCheck = {
    key: string;
    max: number;
    windowMs: number;
};

export type RateLimitDecision = {
    allowed: boolean;
    retryAfterSeconds: number;
};

type Bucket = {
    count: number;
    resetAt: number;
};

/**
 * In-process fixed windows. Render's free web service is one instance and
 * does not provision Redis, so this is the production store. A restart or
 * spin-down clears the buckets, which only makes the limit more permissive.
 * Spend caps do not use this store.
 */
export class MemoryRateLimitStore {
    private readonly buckets = new Map<string, Bucket>();

    consume(checks: RateLimitCheck[], now = Date.now()): RateLimitDecision {
        const active = checks.filter((check) => check.max > 0 && check.windowMs > 0);
        if (active.length === 0) {
            return { allowed: true, retryAfterSeconds: 0 };
        }

        this.prune(now);

        const blocked = active
            .map((check) => this.peek(check, now))
            .filter((state) => state.count >= state.max);

        if (blocked.length > 0) {
            const retryAfterSeconds = Math.max(
                ...blocked.map((state) =>
                    Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
                ),
            );
            return { allowed: false, retryAfterSeconds };
        }

        for (const check of active) {
            const bucket = this.ensure(check, now);
            bucket.count += 1;
        }
        return { allowed: true, retryAfterSeconds: 0 };
    }

    private peek(check: RateLimitCheck, now: number): { count: number; resetAt: number; max: number } {
        const bucket = this.buckets.get(check.key);
        if (!bucket || now >= bucket.resetAt) {
            return { count: 0, resetAt: now + check.windowMs, max: check.max };
        }
        return { count: bucket.count, resetAt: bucket.resetAt, max: check.max };
    }

    private ensure(check: RateLimitCheck, now: number): Bucket {
        const existing = this.buckets.get(check.key);
        if (!existing || now >= existing.resetAt) {
            const created = { count: 0, resetAt: now + check.windowMs };
            this.buckets.set(check.key, created);
            return created;
        }
        return existing;
    }

    private prune(now: number): void {
        if (this.buckets.size < 1_000) return;
        for (const [key, bucket] of this.buckets) {
            if (now >= bucket.resetAt) this.buckets.delete(key);
        }
    }
}
