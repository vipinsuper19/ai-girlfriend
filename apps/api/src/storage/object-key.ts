/**
 * Object keys are the stable paths stored in the database, under `/uploads/`.
 * Signed URLs are derived from them and are never written back as-is.
 */
const OBJECT_KEY =
    /^(?:companions\/[A-Za-z0-9][A-Za-z0-9._-]{0,180}|(?:voice|images)\/[0-9]+\/[A-Za-z0-9][A-Za-z0-9._-]{0,180})$/;

const OBJECT_PREFIX = /^(?:companions|voice\/[0-9]+|images\/[0-9]+)\/?$/;

export function isObjectKey(key: string): boolean {
    if (key.includes('..') || key.includes('\\') || key.includes('\0')) return false;
    return OBJECT_KEY.test(key);
}

/** A folder account deletion may remove: one user's media, or the portrait directory. */
export function isObjectPrefix(prefix: string): boolean {
    if (prefix.includes('..') || prefix.includes('\\') || prefix.includes('\0')) return false;
    return OBJECT_PREFIX.test(prefix);
}

export function storedPath(key: string): string {
    return `/uploads/${key}`;
}

/**
 * Accepts the stored `/uploads/...` path, the same path with a signature query,
 * or an absolute URL (local origin or an S3 presigned URL) and returns the object key.
 */
export function objectKeyFromReference(value: string): string | null {
    const bare = value.split(/[?#]/, 1)[0] ?? '';
    let path = bare;
    if (/^https?:\/\//i.test(path)) {
        try {
            path = decodeURIComponent(new URL(path).pathname);
        } catch {
            return null;
        }
    }

    const marker = '/uploads/';
    const at = path.lastIndexOf(marker);
    if (at >= 0) {
        const key = path.slice(at + marker.length);
        return isObjectKey(key) ? key : null;
    }

    const embedded = path.match(/\/((?:companions|voice|images)\/[^/]+(?:\/[^/]+)?)$/);
    if (!embedded?.[1] || !isObjectKey(embedded[1])) return null;
    return embedded[1];
}
