import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';

import {
    GoogleGenAI,
} from '@google/genai';

import type {
    SpeechToTextProvider,
    TranscribeAudioInput,
} from '../interfaces/speech-to-text.provider.js';

@Injectable()
export class GeminiSpeechToTextProvider
    implements SpeechToTextProvider {

    private readonly client: GoogleGenAI;

    private readonly model =
        process.env.GEMINI_STT_MODEL ??
        'gemini-3.5-transcribe';

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

    async transcribe(
        input: TranscribeAudioInput,
    ): Promise<string> {
        if (!input.audio.length) {
            throw new BadRequestException(
                'Audio file is empty',
            );
        }

        try {
            /*
             * For MVP voice messages we keep the request
             * inline. Gemini supports inline audio for
             * small requests.
             */
            const audioData =
                input.audio.toString('base64');

            const interaction =
                await this.client.interactions.create({
                    model: this.model,
                    input: [
                        {
                            type: 'text',
                            text:
                                'Transcribe the spoken audio. Return only the transcript.',
                        },
                        {
                            type: 'audio',
                            data: audioData,
                            mime_type: input.mimeType,
                        },
                    ],
                });

            const transcript =
                interaction.output_text?.trim();

            if (!transcript) {
                throw new InternalServerErrorException(
                    'Speech-to-text returned an empty transcript',
                );
            }

            return transcript;
        } catch (error) {
            if (
                error instanceof
                BadRequestException
            ) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Speech-to-text failed',
            );
        }
    }
}