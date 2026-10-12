export type UsagePeriod = 'day' | 'month';

/**
 * UTC windows. `day` is [today 00:00, tomorrow 00:00). `month` is the calendar
 * month. Callers compare ISO strings, so both ends are ISO timestamps.
 */
export function usageWindow(
    period: UsagePeriod,
    now = new Date(),
): { start: string; end: string } {
    if (period === 'day') {
        const start = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
        ));
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        return {
            start: start.toISOString(),
            end: end.toISOString(),
        };
    }

    const start = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        1,
    ));
    const end = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + 1,
        1,
    ));
    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}
