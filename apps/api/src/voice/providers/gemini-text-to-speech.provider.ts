import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';

import {
    GoogleGenAI,
} from '@google/genai';

import type {
    GenerateSpeechInput,
    GeneratedSpeech,
    TextToSpeechProvider,
} from '../interfaces/text-to-speech.provider.js';

@Injectable()
export class GeminiTextToSpeechProvider
    implements TextToSpeechProvider {

    private readonly client: GoogleGenAI;

    private readonly model =
        process.env.GEMINI_TTS_MODEL ??
        'gemini-3.1-flash-tts-preview';

    constructor() {
        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error(
                'GEMINI_API_KEY is not defined',
            );
        }

        this.client = new GoogleGenAI({
            apiKey,
        });
    }

    async generateSpeech(
        input: GenerateSpeechInput,
    ): Promise<GeneratedSpeech> {
        try {
            const response =
                await this.client.models.generateContent({
                    model: this.model,
                    contents: [
                        {
                            parts: [
                                {
                                    text:
                                        input.text,
                                },
                            ],
                        },
                    ],
                    config: {
                        responseModalities: [
                            'AUDIO',
                        ],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName:
                                        input.voiceId,
                                },
                            },
                            languageCode:
                                input.language,
                        },
                    },
                });

            const audioData =
                response.candidates?.[0]
                    ?.content
                    ?.parts?.[0]
                    ?.inlineData
                    ?.data;

            if (!audioData) {
                throw new InternalServerErrorException(
                    'Text-to-speech returned no audio',
                );
            }

            /*
             * Gemini returns raw PCM for TTS.
             * Convert it to a WAV container before
             * returning it to the application.
             */
            const pcm =
                Buffer.from(
                    audioData,
                    'base64',
                );

            const wav =
                this.createWavBuffer(
                    pcm,
                    24000,
                    1,
                    16,
                );

            return {
                audio: wav,
                mimeType: 'audio/wav',
                provider: 'gemini',
                voiceId: input.voiceId,
            };
        } catch (error) {
            if (
                error instanceof
                InternalServerErrorException
            ) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Text-to-speech failed',
            );
        }
    }

    private createWavBuffer(
        pcm: Buffer,
        sampleRate: number,
        channels: number,
        bitsPerSample: number,
    ): Buffer {
        const blockAlign =
            channels *
            (bitsPerSample / 8);

        const byteRate =
            sampleRate *
            blockAlign;

        const header =
            Buffer.alloc(44);

        header.write(
            'RIFF',
            0,
            4,
            'ascii',
        );

        header.writeUInt32LE(
            36 + pcm.length,
            4,
        );

        header.write(
            'WAVE',
            8,
            4,
            'ascii',
        );

        header.write(
            'fmt ',
            12,
            4,
            'ascii',
        );

        header.writeUInt32LE(
            16,
            16,
        );

        header.writeUInt16LE(
            1,
            20,
        );

        header.writeUInt16LE(
            channels,
            22,
        );

        header.writeUInt32LE(
            sampleRate,
            24,
        );

        header.writeUInt32LE(
            byteRate,
            28,
        );

        header.writeUInt16LE(
            blockAlign,
            32,
        );

        header.writeUInt16LE(
            bitsPerSample,
            34,
        );

        header.write(
            'data',
            36,
            4,
            'ascii',
        );

        header.writeUInt32LE(
            pcm.length,
            40,
        );

        return Buffer.concat([
            header,
            pcm,
        ]);
    }
}