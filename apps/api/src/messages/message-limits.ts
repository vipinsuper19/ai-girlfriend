/**
 * Chat text must stay under the smaller classifier input limit (Gemini, 8_000)
 * so an accepted message cannot by itself overflow the provider.
 */
export const MESSAGE_CONTENT_MAX = 7_000;
