import { correctText } from '../../editor/correct';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'text-corrector';
  readonly name = 'Mətn Düzəldici';
  readonly description = 'Yerli söz bazası və qaydalarla hərfləri, durğu işarələrini və siyahıları düzəldir.';
  readonly icon = 'FileText';
  async transform(request: TransformationRequest): Promise<TransformationResult> {
    const start = Date.now();
    const result = correctText(request.text, request.options?.preserveFormatting);
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
    } };
  }
}
