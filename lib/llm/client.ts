import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { AppError } from '../errors';
import { stripCodeFence } from './response';

let client: Anthropic | undefined;
export async function executeLLMPrompt(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AppError('CONFIGURATION_ERROR', 'ANTHROPIC_API_KEY serverdə təyin edilməyib.');
  client ??= new Anthropic({ apiKey, timeout: 50_000, maxRetries: 0 });
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 16_384,
      // Sonnet 5 rejects non-default sampling settings; omit all three.
      thinking: { type: 'disabled' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    if (response.stop_reason === 'refusal') {
      throw new AppError('LLM_REFUSAL', 'Model bu mətnin emalını rədd etdi. Mətni dəyişərək yenidən cəhd edin.', 400);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new AppError('LLM_TRUNCATED', 'Modelin cavabı yarımçıq qaldı. Daha qısa mətnlə yenidən cəhd edin.');
    }
    if (response.stop_reason !== 'end_turn') {
      throw new AppError('LLM_INCOMPLETE', 'Model mətnin emalını tamamlaya bilmədi.');
    }
    const text = response.content.filter(block => block.type === 'text').map(block => block.text).join('');
    if (!text.trim()) throw new AppError('LLM_EMPTY', 'Model boş cavab qaytardı.');
    return stripCodeFence(text);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      throw new AppError('LLM_TIMEOUT', 'Emal üçün ayrılan vaxt bitdi. Yenidən cəhd edin.');
    }
    // Never forward provider response bodies, credentials, or input text to clients/logs.
    throw new AppError('LLM_UNAVAILABLE', 'Mətn emalı xidməti hazırda əlçatan deyil. Bir az sonra yenidən cəhd edin.');
  }
}
