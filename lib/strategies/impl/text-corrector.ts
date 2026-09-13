import { executeLLMPrompt } from '@/lib/llm/client';
import type {
  ITextTransformationStrategy,
  TransformationRequest,
  TransformationResult,
} from '../types';

interface TextCorrectorPayload extends Record<string, unknown> {
  transformedText: string;
  correctionsCount?: number;
  detectedLanguage?: string;
}

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'text-corrector';
  readonly name = 'Mətn Düzəldici';
  readonly description =
    'Azərbaycan dilində diakritikləri, durğu işarələrini, abzasları və siyahıları bərpa edir.';
  readonly icon = 'FileText';

  async transform(request: TransformationRequest): Promise<TransformationResult> {
    const startedAt = Date.now();
    const tone = request.options?.tone ?? 'default';
    const preserveFormatting = request.options?.preserveFormatting ?? false;
    const customRules = request.options?.customRules?.filter(Boolean).slice(0, 10) ?? [];

    const systemPrompt = `You are SlothAI, a precision Azerbaijani NLP restoration engine.
Your task is to restore and normalize the user's Azerbaijani text without inventing facts or changing its intended meaning.

RULES:
1. DIACRITICS: Restore Azerbaijani characters contextually: ç, ğ, ı, İ, ö, ş, ü, ə. Never apply blind character substitution; infer the correct word from sentence context.
2. SPELLING: Correct obvious Azerbaijani spelling and typing mistakes while preserving names, technical terms, URLs, emails, code, identifiers and numbers.
3. PUNCTUATION: Restore commas, periods, question marks, colons, semicolons, quotation marks and dashes according to sentence structure.
4. CASING: Correct sentence capitalization and proper nouns.
5. PARAGRAPHS: Split dense text into logical paragraphs when it improves readability.
6. LISTS: Convert genuine enumerations into Markdown bullet or numbered lists. Do not turn normal prose into a list.
7. MEANING: Preserve the original intent, factual claims, names and numerical values. Do not add new information.
8. LANGUAGE: Keep the output in Azerbaijani unless the source contains intentional foreign-language fragments.
9. TONE: Requested tone is '${tone}'. For 'default', preserve the author's tone. For 'formal' or 'casual', adjust wording conservatively without changing meaning.
10. FORMATTING: preserveFormatting=${preserveFormatting}. If true, retain useful existing line breaks/structure wherever possible.
11. OUTPUT: Return ONLY a JSON object with this schema:
{
  "transformedText": "string",
  "correctionsCount": 0,
  "detectedLanguage": "az"
}
correctionsCount must be a non-negative integer estimate of meaningful edits made.
${customRules.length ? `12. EXTRA USER RULES:\n- ${customRules.join('\n- ')}` : ''}`;

    const payload = await executeLLMPrompt<TextCorrectorPayload>(systemPrompt, request.text);
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
