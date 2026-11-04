import { formatEmail } from '../../editor/correct';
import { optionalPunctCase } from '../punctcase';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult, TransformationContext } from '../types';

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'gmail-corrector';
  readonly name = 'E-poçt Düzəldici';
  readonly description = 'Mətni düzəldir, seçilmiş salamlaşma və bağlanış əlavə edir; e-poçt göndərmir.';
  readonly icon = 'Mail';
  async transform(request: TransformationRequest, context: TransformationContext = {}): Promise<TransformationResult> {
    const start = Date.now();
    const baseline = formatEmail(request.text, request.options, context);
    const enhanced = await optionalPunctCase(request.text, baseline, request.options?.usePunctCase,
      value => formatEmail(value, request.options));
    const result = enhanced.correction;
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az', processingLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-rules',
      ...(enhanced.stats ? { punctCase: enhanced.stats } : {}),
    } };
  }
}
