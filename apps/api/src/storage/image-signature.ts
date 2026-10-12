export type ImageKind = 'jpeg' | 'png' | 'webp';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Identifies a JPEG, PNG, or WebP from its leading bytes.
 * The declared MIME type and file extension are not consulted.
 */
export function imageKindFromBytes(bytes: Buffer | undefined | null): ImageKind | null {
    if (!bytes || bytes.length < 3) return null;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
    if (bytes.length >= PNG.length && bytes.subarray(0, PNG.length).equals(PNG)) return 'png';
    if (
        bytes.length >= 12
        && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
        && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
        return 'webp';
    }
    return null;
}

export function extensionForImageKind(kind: ImageKind): string {
    if (kind === 'jpeg') return '.jpg';
    if (kind === 'png') return '.png';
    return '.webp';
}
