import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { GenerateSpeechInput, GeneratedSpeech, TextToSpeechProvider } from '../interfaces/text-to-speech.provider.js';
import type { SpeechToTextProvider, TranscribeAudioInput } from '../interfaces/speech-to-text.provider.js';

/**
 * Used only when LLM_PROVIDER=mock, so the process can boot without
 * GEMINI_API_KEY. Voice is not part of the emulator flows. A call fails
 * closed instead of reaching Gemini.
 */
@Injectable()
export class UnavailableSpeechToTextProvider implements SpeechToTextProvider {
    async transcribe(_input: TranscribeAudioInput): Promise<string> {
        throw new ServiceUnavailableException('Speech recognition is not available on the test API');
    }
}

@Injectable()
export class UnavailableTextToSpeechProvider implements TextToSpeechProvider {
    async generateSpeech(_input: GenerateSpeechInput): Promise<GeneratedSpeech> {
        throw new ServiceUnavailableException('Speech synthesis is not available on the test API');
    }
}
