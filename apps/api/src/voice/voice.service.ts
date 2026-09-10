import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { AiService } from '../ai/ai.service.js';
import { StorageService } from '../storage/storage.service.js';

import {
    SPEECH_TO_TEXT_PROVIDER,
    type SpeechToTextProvider,
} from './interfaces/speech-to-text.provider.js';

import {
    TEXT_TO_SPEECH_PROVIDER,
    type TextToSpeechProvider,
} from './interfaces/text-to-speech.provider.js';

@Injectable()
export class VoiceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly storageService: StorageService,

        @Inject(SPEECH_TO_TEXT_PROVIDER)
        private readonly speechToText:
            SpeechToTextProvider,

        @Inject(TEXT_TO_SPEECH_PROVIDER)
        private readonly textToSpeech:
            TextToSpeechProvider,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    /**
     * Convert uploaded audio into text.
     */
    async transcribe(
        audio: Buffer,
        mimeType: string,
    ) {
        if (!audio?.length) {
            throw new BadRequestException(
                'Audio file is required',
            );
        }

        if (!mimeType?.startsWith('audio/')) {
            throw new BadRequestException(
                'Invalid audio file type',
            );
        }

        const text =
            await this.speechToText.transcribe({
                audio,
                mimeType,
            });

        const cleanText =
            text.trim();

        if (!cleanText) {
            throw new BadRequestException(
                'Could not detect speech in audio',
            );
        }

        return {
            text: cleanText,
        };
    }

    /**
     * Convert text to the companion's configured voice.
     *
     * This endpoint does not create a Message.
     * It only generates and stores audio.
     */
    async synthesize(
        userId: number,
        companionId: number,
        text: string,
    ) {
        const cleanText =
            text.trim();

        if (!cleanText) {
            throw new BadRequestException(
                'Text is required',
            );
        }

        /*
         * Verify companion ownership.
         */
        const companion =
            await this.db.orm.public.Companion
                .where({
                    id: companionId,
                    userId,
                    status: 'ACTIVE',
                })
                .first();

        if (!companion) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        /*
         * Load configured companion voice.
         */
        const companionVoice =
            await this.db.orm.public.CompanionVoice
                .where({
                    companionId,
                })
                .first();

        if (!companionVoice) {
            throw new NotFoundException(
                'Companion voice not configured',
            );
        }

        /*
         * Generate TTS audio.
         */
        const speech =
            await this.textToSpeech.generateSpeech({
                text: cleanText,
                voiceId:
                    companionVoice.voiceId,
                language:
                    companionVoice.language,
            });

        /*
         * Store generated audio using the
         * application-wide StorageService.
         */
        const audioUrl =
            await this.storageService.saveVoiceAudio(
                userId,
                speech.audio,
                '.wav',
            );

        return {
            audioUrl,
            mimeType:
                speech.mimeType,
            provider:
                speech.provider,
            voiceId:
                speech.voiceId,
        };
    }

    /**
     * Complete voice conversation.
     *
     * USER AUDIO
     *     ↓
     * Speech-to-Text
     *     ↓
     * USER AUDIO Message
     *     ↓
     * AI generation WITHOUT persistence
     *     ↓
     * Text-to-Speech
     *     ↓
     * ASSISTANT AUDIO Message
     */
    async respond(
        userId: number,
        conversationId: number,
        audio: Buffer,
        mimeType: string,
    ) {
        if (!audio?.length) {
            throw new BadRequestException(
                'Audio file is required',
            );
        }

        if (!mimeType?.startsWith('audio/')) {
            throw new BadRequestException(
                'Invalid audio file type',
            );
        }

        /*
         * ------------------------------------------------------
         * 1. Validate conversation ownership
         * ------------------------------------------------------
         */
        const conversation =
            await this.db.orm.public.Conversation
                .where({
                    id: conversationId,
                    userId,
                    deletedAt: null,
                })
                .first();

        if (!conversation) {
            throw new NotFoundException(
                'Conversation not found',
            );
        }

        /*
         * ------------------------------------------------------
         * 2. Load companion
         * ------------------------------------------------------
         */
        const companion =
            await this.db.orm.public.Companion
                .where({
                    id: conversation.companionId,
                    userId,
                    status: 'ACTIVE',
                })
                .first();

        if (!companion) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        /*
         * ------------------------------------------------------
         * 3. Load companion voice
         * ------------------------------------------------------
         */
        const companionVoice =
            await this.db.orm.public.CompanionVoice
                .where({
                    companionId:
                        companion.id,
                })
                .first();

        if (!companionVoice) {
            throw new NotFoundException(
                'Companion voice not configured',
            );
        }

        /*
         * ------------------------------------------------------
         * 4. Speech-to-text
         * ------------------------------------------------------
         */
        const transcript =
            await this.speechToText.transcribe({
                audio,
                mimeType,
            });

        const cleanTranscript =
            transcript.trim();

        if (!cleanTranscript) {
            throw new BadRequestException(
                'Could not detect speech in audio',
            );
        }

        /*
         * ------------------------------------------------------
         * 5. Store user's original audio
         * ------------------------------------------------------
         */
        const userAudioUrl =
            await this.storageService.saveVoiceAudio(
                userId,
                audio,
                this.getAudioExtension(
                    mimeType,
                ),
            );

        /*
         * ------------------------------------------------------
         * 6. Create USER AUDIO message
         * ------------------------------------------------------
         */
        const now =
            new Date().toISOString();

        const userMessage =
            await this.db.orm.public.Message.create({
                conversationId,
                role: 'USER',
                type: 'AUDIO',
                content:
                    cleanTranscript,
                metadata: {
                    mimeType,
                    source: 'voice',
                },
                audioUrl:
                    userAudioUrl,
                imageUrl: null,
                updatedAt: now,
            });

        /*
         * ------------------------------------------------------
         * 7. Update conversation timestamp
         * ------------------------------------------------------
         */
        await this.db.orm.public.Conversation
            .where({
                id: conversationId,
                userId,
            })
            .update({
                lastMessageAt: now,
                updatedAt: now,
            });

        /*
         * ------------------------------------------------------
         * 8. Generate AI response
         *
         * IMPORTANT:
         * persistMessage=false prevents AiService from
         * creating an intermediate ASSISTANT/TEXT message.
         *
         * The returned content will be converted to audio
         * and persisted below as ASSISTANT/AUDIO.
         * ------------------------------------------------------
         */
        const aiResponse =
            await this.aiService.generateResponse(
                userId,
                conversationId,
                {
                    persistMessage: false,
                },
            );

        const assistantText =
            aiResponse?.content?.trim();

        if (!assistantText) {
            throw new BadRequestException(
                'AI returned an empty response',
            );
        }

        /*
         * ------------------------------------------------------
         * 9. Generate companion voice
         * ------------------------------------------------------
         */
        const speech =
            await this.textToSpeech.generateSpeech({
                text: assistantText,
                voiceId:
                    companionVoice.voiceId,
                language:
                    companionVoice.language,
            });

        /*
         * ------------------------------------------------------
         * 10. Store generated assistant audio
         * ------------------------------------------------------
         */
        const assistantAudioUrl =
            await this.storageService.saveVoiceAudio(
                userId,
                speech.audio,
                '.wav',
            );

        /*
         * ------------------------------------------------------
         * 11. Create ONE ASSISTANT AUDIO message
         * ------------------------------------------------------
         */
        const assistantMessage =
            await this.db.orm.public.Message.create({
                conversationId,
                role: 'ASSISTANT',
                type: 'AUDIO',
                content: assistantText,
                metadata: {
                    source: 'voice',
                    provider:
                        speech.provider,
                    voiceId:
                        speech.voiceId,
                    mimeType:
                        speech.mimeType,
                },
                audioUrl:
                    assistantAudioUrl,
                imageUrl: null,
                updatedAt:
                    new Date().toISOString(),
            });

        /*
         * ------------------------------------------------------
         * 12. Update conversation timestamp
         * ------------------------------------------------------
         */
        await this.db.orm.public.Conversation
            .where({
                id: conversationId,
                userId,
            })
            .update({
                lastMessageAt:
                    new Date().toISOString(),
                updatedAt:
                    new Date().toISOString(),
            });

        /*
         * ------------------------------------------------------
         * 13. Return complete voice response
         * ------------------------------------------------------
         */
        return {
            transcript:
                cleanTranscript,

            userMessage,

            assistantMessage,

            audio: {
                audioUrl:
                    assistantAudioUrl,
                mimeType:
                    speech.mimeType,
                provider:
                    speech.provider,
                voiceId:
                    speech.voiceId,
            },
        };
    }

    /**
     * Resolve uploaded audio MIME type to a
     * safe storage extension.
     */
    private getAudioExtension(
        mimeType: string,
    ): string {
        const extensions:
            Record<string, string> = {
            'audio/wav': '.wav',
            'audio/x-wav': '.wav',
            'audio/mpeg': '.mp3',
            'audio/mp3': '.mp3',
            'audio/mp4': '.m4a',
            'audio/x-m4a': '.m4a',
            'audio/ogg': '.ogg',
            'audio/webm': '.webm',
            'audio/flac': '.flac',
            'audio/aac': '.aac',
        };

        return (
            extensions[mimeType] ??
            '.audio'
        );
    }
}