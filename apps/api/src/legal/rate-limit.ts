export class SlidingWindowLimiter {
    private readonly hits = new Map<string, number[]>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
        private readonly now: () => number = () => Date.now(),
    ) {}

    /** Returns true when this key is still inside the window's allowance. */
    allow(key: string): boolean {
        const at = this.now();
        const recent = (this.hits.get(key) ?? []).filter((ts) => at - ts < this.windowMs);
        if (recent.length >= this.limit) {
            this.hits.set(key, recent);
            return false;
        }
        recent.push(at);
        this.hits.set(key, recent);
        return true;
    }
}
