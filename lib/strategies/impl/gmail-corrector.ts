import { formatEmail } from '../../editor/correct';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'gmail-corrector';
  readonly name = 'E-poçt Düzəldici';
  readonly description = 'Mətni düzəldir, mövzu, salamlaşma və bağlanış əlavə edir; e-poçt göndərmir.';
  readonly icon = 'Mail';
  async transform(request: TransformationRequest): Promise<TransformationResult> {
    const start = Date.now();
    const result = formatEmail(request.text);
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
    } };
  }
}
