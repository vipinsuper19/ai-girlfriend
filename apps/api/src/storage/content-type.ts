const CONTENT_TYPES: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    flac: 'audio/flac',
    aac: 'audio/aac',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};

export function contentTypeForKey(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase() ?? '';
    return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
