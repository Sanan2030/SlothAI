import { correctText } from '../../editor/correct';
import { optionalPunctCase } from '../punctcase';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult, TransformationContext } from '../types';

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'text-corrector';
  readonly name = 'Mətn Düzəldici';
  readonly description = 'Yazılışı, durğu işarələrini və abzasları proqramın qaydaları ilə düzəldir.';
  readonly icon = 'FileText';
  async transform(request: TransformationRequest, context: TransformationContext = {}): Promise<TransformationResult> {
    const start = Date.now();
    const baseline = correctText(request.text, request.options?.preserveFormatting, context);
    const enhanced = await optionalPunctCase(request.text, baseline, request.options?.usePunctCase,
      value => correctText(value, request.options?.preserveFormatting));
    const result = enhanced.correction;
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az', processingLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
      ...(enhanced.stats ? { punctCase: enhanced.stats } : {}),
    } };
  }
}
