import { correctText } from '../../editor/correct';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult, TransformationContext } from '../types';

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'text-corrector';
  readonly name = 'Mətn Düzəldici';
  readonly description = 'Yazılışı, durğu işarələrini və abzasları proqramın qaydaları ilə düzəldir.';
  readonly icon = 'FileText';
  async transform(request: TransformationRequest, context: TransformationContext = {}): Promise<TransformationResult> {
    const start = Date.now();
    const result = correctText(request.text, request.options?.preserveFormatting, context);
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az', processingLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
    } };
  }
}
