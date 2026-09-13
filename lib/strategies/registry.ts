import type { ITextTransformationStrategy, StrategyDescriptor } from './types';

export class StrategyNotFoundError extends Error {
  constructor(id: string) {
    super(`Transformation strategy '${id}' was not found.`);
    this.name = 'StrategyNotFoundError';
  }
}

export class TextTransformationRegistry {
  private static instance: TextTransformationRegistry | undefined;
  private readonly strategies = new Map<string, ITextTransformationStrategy>();

  private constructor() {}

  static getInstance(): TextTransformationRegistry {
    if (!TextTransformationRegistry.instance) {
      TextTransformationRegistry.instance = new TextTransformationRegistry();
    }
    return TextTransformationRegistry.instance;
  }

  register(strategy: ITextTransformationStrategy): this {
    this.strategies.set(strategy.id, strategy);
    return this;
  }

  has(id: string): boolean {
    return this.strategies.has(id);
  }

  get(id: string): ITextTransformationStrategy {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new StrategyNotFoundError(id);
    }
    return strategy;
  }

  listStrategies(): StrategyDescriptor[] {
    return Array.from(this.strategies.values()).map(({ id, name, description, icon }) => ({
      id,
      name,
      description,
      icon,
    }));
  }
}
