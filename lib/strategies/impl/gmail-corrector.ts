import { formatEmail } from '../../editor/correct';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult, TransformationContext } from '../types';

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'gmail-corrector';
  readonly name = 'E-poçt Düzəldici';
  readonly description = 'Mətni düzəldir, seçilmiş salamlaşma və bağlanış əlavə edir; e-poçt göndərmir.';
  readonly icon = 'Mail';
  async transform(request: TransformationRequest, context: TransformationContext = {}): Promise<TransformationResult> {
    const start = Date.now();
    const result = formatEmail(request.text, request.options, context);
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az', processingLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
    } };
  }
}
