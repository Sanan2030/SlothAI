import { formatEmail } from '../../editor/correct';
import { transformWithModel } from '../../local-model/transform';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult } from '../types';

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'gmail-corrector';
  readonly name = 'E-poçt Düzəldici';
  readonly description = 'Mətni düzəldir, mövzu, salamlaşma və bağlanış əlavə edir; e-poçt göndərmir.';
  readonly icon = 'Mail';
  async transform(request: TransformationRequest): Promise<TransformationResult> {
    if (request.options?.engine === 'local-model') return transformWithModel(request, this.id, 'Format as a professional Azerbaijani business email with Mövzu, salutation, body and sign-off. Never invent sender names or facts.');
    const start = Date.now();
    const result = formatEmail(request.text);
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
    } };
  }
}
