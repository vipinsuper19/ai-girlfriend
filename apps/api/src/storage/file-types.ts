const AVATAR_EXTENSIONS: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};

/**
 * Uploads are served as static files, so the stored extension comes from the
 * checked MIME type and never from the client's file name.
 */
export function avatarExtension(mimeType: string | null | undefined): string | null {
    return AVATAR_EXTENSIONS[mimeType ?? ''] ?? null;
}

/** Portrait files are named `${companionId}-${uuid}.ext`; this picks one companion's files. */
export function companionFilesIn(
    names: readonly string[],
    companionIds: readonly number[],
): string[] {
    const prefixes = companionIds.map((id) => `${id}-`);
    return names.filter((name) =>
        !name.includes('/') &&
        !name.includes('\\') &&
        prefixes.some((prefix) => name.startsWith(prefix)),
    );
}

/** The file name of a voice note this API stored for this user, or null for any other path. */
export function ownVoiceFile(url: unknown, userId: number): string | null {
    if (typeof url !== 'string') return null;
    const prefix = `/uploads/voice/${userId}/`;
    if (!url.startsWith(prefix)) return null;
    const name = url.slice(prefix.length);
    return /^[0-9a-f-]+\.[a-z0-9]+$/i.test(name) ? name : null;
}
