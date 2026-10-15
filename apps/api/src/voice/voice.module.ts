import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module.js';
import { UsageModule } from '../usage/usage.module.js';

import {
  SPEECH_TO_TEXT_PROVIDER,
} from './interfaces/speech-to-text.provider.js';

import {
  TEXT_TO_SPEECH_PROVIDER,
} from './interfaces/text-to-speech.provider.js';

import { llmProviderFromEnv } from '../ai/llm-provider.js';

import {
  GeminiSpeechToTextProvider,
} from './providers/gemini-speech-to-text.provider.js';

import {
  GeminiTextToSpeechProvider,
} from './providers/gemini-text-to-speech.provider.js';

import {
  UnavailableSpeechToTextProvider,
  UnavailableTextToSpeechProvider,
} from './providers/unavailable-voice.providers.js';

import { VoiceController } from './voice.controller.js';
import { VoiceService } from './voice.service.js';

const voiceProviders = llmProviderFromEnv(process.env) === 'mock'
  ? [
      UnavailableSpeechToTextProvider,
      {
        provide: SPEECH_TO_TEXT_PROVIDER,
        useExisting: UnavailableSpeechToTextProvider,
      },
      UnavailableTextToSpeechProvider,
      {
        provide: TEXT_TO_SPEECH_PROVIDER,
        useExisting: UnavailableTextToSpeechProvider,
      },
    ]
  : [
      GeminiSpeechToTextProvider,
      {
        provide: SPEECH_TO_TEXT_PROVIDER,
        useExisting: GeminiSpeechToTextProvider,
      },
      GeminiTextToSpeechProvider,
      {
        provide: TEXT_TO_SPEECH_PROVIDER,
        useExisting: GeminiTextToSpeechProvider,
      },
    ];

@Module({
  imports: [
    AiModule,
    UsageModule,
  ],
  controllers: [
    VoiceController,
  ],
  providers: [
    VoiceService,
    ...voiceProviders,
  ],
  exports: [
    VoiceService,
  ],
})
export class VoiceModule { }