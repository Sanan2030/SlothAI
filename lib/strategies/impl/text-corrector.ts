import {loadCharSpell} from '../../editor/charspell/load';
import {createCharSpellInference} from '../../editor/charspell/runtime';
import { correctText } from '../../editor/correct';
import { automaticPunctCase } from '../punctcase';
import { initialWordLMDecisions, scoreWordLMDocument } from '../../editor/wordlm/runtime';
import type { ITextTransformationStrategy, TransformationRequest, TransformationResult, TransformationContext } from '../types';

export class AzerbaijaniTextCorrectorStrategy implements ITextTransformationStrategy {
  readonly id = 'text-corrector';
  readonly name = 'Mətn Düzəldici';
  readonly description = 'Yerli modellərlə yazılışı, durğu işarələrini və böyük/kiçik hərfləri avtomatik düzəldir.';
  readonly icon = 'FileText';
  async transform(request: TransformationRequest, context: TransformationContext = {}): Promise<TransformationResult> {
    const start = Date.now();
    const decisions = initialWordLMDecisions();
    const charModel = await loadCharSpell();
    const charSpell = createCharSpellInference(charModel);
    const baseline = correctText(request.text, request.options?.preserveFormatting, { ...context, charSpell, wordLMMode: 'automatic', wordLMDecisions: decisions });
    const enhanced = await automaticPunctCase(request.text, baseline,
      value => correctText(value, request.options?.preserveFormatting, { wordLMMode: 'automatic', charSpell: createCharSpellInference(charModel) }));
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
