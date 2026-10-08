export interface AudioStorage {
    save(
        audio: Buffer,
        options: {
            mimeType: string;
            userId: number;
            companionId: number;
            messageId?: number;
        },
    ): Promise<string>;
}

export const AUDIO_STORAGE = Symbol(
    'AUDIO_STORAGE',
);