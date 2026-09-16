import type { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';
import { correctionRules, optionInstructions } from '../prompt';
import { executeLLMPrompt } from '../../llm/client';
import { parseTransformationResponse } from '../../llm/response';

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'text-corrector';
  readonly name = 'Mətn Düzəldici';
  readonly description = 'Hərfləri, durğu işarələrini, abzasları və siyahıları səliqəyə salır.';
  readonly icon = 'FileText';

  async transform(request: TransformationRequest): Promise<TransformationResult> {
    const started = Date.now();
    const raw = await executeLLMPrompt(correctionRules + `\n` + optionInstructions(request.options), request.text);
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
