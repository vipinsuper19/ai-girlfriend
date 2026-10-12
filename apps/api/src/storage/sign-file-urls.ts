const FILE_URL_FIELDS = new Set(['audioUrl', 'imageUrl', 'avatarUrl']);

/**
 * Rewrites stored file paths in API payloads to short-lived URLs.
 * Other strings, including message text, are left alone.
 */
export async function signFileUrlFields<T>(
    value: T,
    sign: (stored: string) => Promise<string>,
    seen = new WeakSet<object>(),
): Promise<T> {
    return walk(value, sign, seen) as Promise<T>;
}

async function walk(
    value: unknown,
    sign: (stored: string) => Promise<string>,
    seen: WeakSet<object>,
): Promise<unknown> {
    if (value == null || typeof value !== 'object') return value;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (seen.has(value)) return value;
    seen.add(value);

    if (Array.isArray(value)) {
        return Promise.all(value.map((item) => walk(item, sign, seen)));
    }

    const source = value as Record<string, unknown>;
    const entries = await Promise.all(
        Object.entries(source).map(async ([key, child]) => {
            if (FILE_URL_FIELDS.has(key) && typeof child === 'string' && child) {
                return [key, await sign(child)] as const;
            }
            return [key, await walk(child, sign, seen)] as const;
        }),
    );
    return Object.fromEntries(entries);
}
