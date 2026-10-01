export interface GenerateSpeechInput {
    text: string;
    voiceId: string;
    language?: string;
    speed?: number;
    pitch?: number;
    style?: string;
}

export interface GeneratedSpeech {
    audio: Buffer;
    mimeType: string;
    provider: string;
    voiceId: string;
}

export interface TextToSpeechProvider {
    generateSpeech(
        input: GenerateSpeechInput,
    ): Promise<GeneratedSpeech>;
}

export const TEXT_TO_SPEECH_PROVIDER = Symbol(
    'TEXT_TO_SPEECH_PROVIDER',
);