export interface TranscribeAudioInput {
    audio: Buffer;
    mimeType: string;
    fileName?: string;
}

export interface SpeechToTextProvider {
    transcribe(
        input: TranscribeAudioInput,
    ): Promise<string>;
}

export const SPEECH_TO_TEXT_PROVIDER = Symbol(
    'SPEECH_TO_TEXT_PROVIDER',
);