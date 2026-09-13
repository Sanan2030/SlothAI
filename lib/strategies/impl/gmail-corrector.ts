import { executeLLMPrompt } from '@/lib/llm/client';
import type {
  ITextTransformationStrategy,
  TransformationRequest,
  TransformationResult,
} from '../types';

interface GmailPayload extends Record<string, unknown> {
  transformedText: string;
  correctionsCount?: number;
  detectedLanguage?: string;
}

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'gmail-corrector';
  readonly name = 'E-poçt Düzəldici';
  readonly description =
    'Xam qeydləri aydın mövzu, salamlaşma, əsas mətn və peşəkar bağlanışla işgüzar e-poçta çevirir.';
  readonly icon = 'Mail';

  async transform(request: TransformationRequest): Promise<TransformationResult> {
    const startedAt = Date.now();
    const tone = request.options?.tone ?? 'formal';

    const systemPrompt = `You are SlothAI Email Editor.
Transform the user's raw Azerbaijani note into a polished business email.

RULES:
1. Preserve all facts, names, dates, numbers, links and the user's intent.
2. Correct Azerbaijani diacritics, spelling and punctuation contextually.
3. Produce a concise email structure: Mövzu, greeting, body paragraphs, professional closing.
4. Tone: ${tone}.
5. Do not invent a recipient name, sender name, company, commitment, deadline or factual detail that is absent from the input.
6. If the sender's name is absent, use a neutral closing without fabricating a name.
7. Return ONLY JSON:
{
  "transformedText": "string",
  "correctionsCount": 0,
  "detectedLanguage": "az"
}`;

    const payload = await executeLLMPrompt<GmailPayload>(systemPrompt, request.text);
    if (typeof payload.transformedText !== 'string' || !payload.transformedText.trim()) {
      throw new Error('LLM response did not include a valid transformedText value.');
    }

    const corrections = Number(payload.correctionsCount ?? 0);

    return {
      transformedText: payload.transformedText.trim(),
      metadata: {
        correctionsMade: Number.isFinite(corrections) ? Math.max(0, Math.trunc(corrections)) : 0,
        detectedLanguage:
          typeof payload.detectedLanguage === 'string' ? payload.detectedLanguage : 'az',
        executionTimeMs: Date.now() - startedAt,
        strategyUsed: this.id,
      },
    };
  }
}
