import {loadCharSpell} from '../../editor/charspell/load';
import {createCharSpellInference} from '../../editor/charspell/runtime';
import { formatEmail } from '../../editor/correct';
import { automaticPunctCase } from '../punctcase';
import { initialWordLMDecisions, scoreWordLMDocument } from '../../editor/wordlm/runtime';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult, TransformationContext } from '../types';

export class GmailCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'gmail-corrector';
  readonly name = 'E-poçt Düzəldici';
  readonly description = 'Mətni düzəldir, seçilmiş salamlaşma və bağlanış əlavə edir; e-poçt göndərmir.';
  readonly icon = 'Mail';
  async transform(request: TransformationRequest, context: TransformationContext = {}): Promise<TransformationResult> {
    const start = Date.now();
    const decisions = initialWordLMDecisions();
    const charModel = await loadCharSpell();
    const charSpell = createCharSpellInference(charModel);
    const baseline = formatEmail(request.text, request.options, { ...context, charSpell, wordLMMode: 'automatic', wordLMDecisions: decisions });
    const enhanced = await automaticPunctCase(request.text, baseline,
      value => formatEmail(value, request.options, { wordLMMode: 'automatic', charSpell: createCharSpellInference(charModel) }));
    const result = enhanced.correction;
    const wordLM = scoreWordLMDocument(result.text, decisions);
    return { transformedText: result.text, metadata: {
      correctionsMade: result.corrections, detectedLanguage: 'az', processingLanguage: 'az',
      executionTimeMs: Date.now() - start, strategyUsed: this.id, engine: 'local-models',
      wordLM, charSpell: charSpell.stats,
      ...(enhanced.stats ? { punctCase: enhanced.stats } : {}),
    } };
  }
}
