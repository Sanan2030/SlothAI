export type TransformationTone = 'default' | 'formal' | 'casual';

export interface TransformationOptions {
  tone?: TransformationTone;
  preserveFormatting?: boolean;
  customRules?: string[];
}

export interface TransformationRequest {
  text: string;
  options?: TransformationOptions;
}

export interface TransformationMetadata {
  correctionsMade: number;
  detectedLanguage: string;
  executionTimeMs: number;
  strategyUsed: string;
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
  transform(request: TransformationRequest): Promise<TransformationResult>;
}
