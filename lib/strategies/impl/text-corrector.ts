import { correctText } from '../../editor/correct';
import { transformWithModel } from '../../local-model/transform';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'text-corrector';
  readonly name = 'Mətn Düzəldici';
  readonly description = 'Seçilmiş yerli mühərriklə yazılışı, durğu işarələrini və abzasları düzəldir.';
  readonly icon = 'FileText';
  async transform(request: TransformationRequest): Promise<TransformationResult> {
    if (request.options?.engine === 'local-model') return transformWithModel(request, this.id, 'Polish the supplied text without changing its genre.');
    const start = Date.now();
    const result = correctText(request.text, request.options?.preserveFormatting);
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
    } };
  }
}
