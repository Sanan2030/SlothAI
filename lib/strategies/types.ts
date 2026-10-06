import type { InferenceRunner, InferenceStats } from '../editor/inference-cache';

export interface TransformationOptions {
  preserveFormatting?: boolean;
  emailGreeting?: string;
  omitSubject?: boolean;
}

export interface TransformationRequest {
  text: string;
  options?: TransformationOptions;
}

export interface TransformationContext { inference?: InferenceRunner }

export interface TransformationMetadata {
  /** Speculative heads are optional; context mismatches rerun normal inference. */
  inference?: InferenceStats;
  correctionsMade: number;
  detectedLanguage: string;
  /** Processing language; detectedLanguage is a deprecated compatibility alias. */
  processingLanguage?: 'az';
  executionTimeMs: number;
  strategyUsed: string;
  engine: 'local-rules';
}

export interface TransformationResult {
  transformedText: string;
  metadata: TransformationMetadata;
}

export interface StrategyDescriptor {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface ITextTransformationStrategy extends StrategyDescriptor {
  transform(request: TransformationRequest, context?: TransformationContext): Promise<TransformationResult>;
}
