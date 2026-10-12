const DEFAULT_MAX_KEYS = 10_000;

export class SlidingWindowLimiter {
    private readonly hits = new Map<string, number[]>();
    private lastSweep = 0;

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
        private readonly now: () => number = () => Date.now(),
        private readonly maxKeys = DEFAULT_MAX_KEYS,
    ) {}

    get size(): number {
        return this.hits.size;
    }

    /** Returns true when this key is still inside the window's allowance. */
    allow(key: string): boolean {
        const at = this.now();
        this.sweep(at, key);
        const recent = (this.hits.get(key) ?? []).filter((ts) => at - ts < this.windowMs);
        if (recent.length >= this.limit) {
            this.hits.set(key, recent);
            return false;
        }
        recent.push(at);
        this.hits.set(key, recent);
        return true;
    }

    /**
     * Drops keys whose hits have all left the window, at least once per window.
     * If the map is still at the cap, the key with the oldest hit is removed
     * so a new address can be recorded.
     */
    private sweep(at: number, currentKey: string): void {
        const due = at - this.lastSweep >= this.windowMs;
        if (!due && this.hits.size < this.maxKeys) return;
        this.lastSweep = at;
        for (const [key, stamps] of this.hits) {
            const recent = stamps.filter((ts) => at - ts < this.windowMs);
            if (recent.length === 0) this.hits.delete(key);
            else if (recent.length !== stamps.length) this.hits.set(key, recent);
        }
        while (this.hits.size >= this.maxKeys && !this.hits.has(currentKey)) {
            this.evictOldest();
        }
    }

    private evictOldest(): void {
        let oldestKey: string | undefined;
        let oldestAt = Infinity;
        for (const [key, stamps] of this.hits) {
            const first = stamps[0] ?? Infinity;
            if (first < oldestAt) {
                oldestAt = first;
                oldestKey = key;
            }
        }
        if (oldestKey !== undefined) this.hits.delete(oldestKey);
    }
}
