import type { TransformationRequest, TransformationResult } from '../strategies/types';
import { buildPrompt } from './protocol';

export async function transformWithModel(request: TransformationRequest, strategyId: string, instruction: string): Promise<TransformationResult> {
  const start = Date.now();
  const { generateLocally } = await import('./client');
  const transformedText = await generateLocally(buildPrompt(instruction, request.options?.preserveFormatting), request.text);
  return { transformedText, metadata: {
    correctionsMade: null, detectedLanguage: 'az', executionTimeMs: Date.now() - start,
    strategyUsed: strategyId, engine: 'local-model',
  } };
}
