export interface TransformationOptions {
  preserveFormatting?: boolean;
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
  transform(request: TransformationRequest): Promise<TransformationResult>;
}
