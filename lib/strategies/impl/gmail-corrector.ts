import type { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';
import { correctionRules, optionInstructions } from '../prompt';
import { executeLLMPrompt } from '../../llm/client';
import { parseTransformationResponse } from '../../llm/response';

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'gmail-corrector';
  readonly name = 'Gmail Düzəldici';
  readonly description = 'Qeydlərinizi peşəkar Azərbaycan dilində işgüzar e-poçta çevirir.';
  readonly icon = 'Mail';

  async transform(request: TransformationRequest): Promise<TransformationResult> {
    const started = Date.now();
    const raw = await executeLLMPrompt(correctionRules + `\nAfter applying the ordered corrections, format a professional Azerbaijani business email:
start with "Mövzu: " and a concise subject derived from the source; add a salutation,
clear body paragraphs (lists when appropriate), and "Hörmətlə," as sign-off.
Use recipient and sender names only when supplied; otherwise use "Salam," and omit
an invented signature. Never invent dates, commitments, contact details or attachments.
Include all provided substantive information. Do not send email; return only the draft.
Keep the same JSON contract including a genuine estimated correctionsCount.` + optionInstructions(request.options), request.text);
    const result = parseTransformationResponse(raw);
    return {
      transformedText: result.transformedText,
      metadata: {
        correctionsMade: result.correctionsCount,
        detectedLanguage: 'az',
        executionTimeMs: Date.now() - started,
        strategyUsed: this.id,
      },
    };
  }
}
