export type Provider = 'openai' | 'anthropic';

export class UnsupportedProviderError extends Error {
  readonly code = 'UNSUPPORTED_LLM_PROVIDER';
  constructor() {
    super("Unsupported LLM_PROVIDER. Use 'openai' or 'anthropic'.");
    this.name = 'UnsupportedProviderError';
  }
}

export function getProvider(): Provider {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase() || 'openai';
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new UnsupportedProviderError();
  }
  return provider;
}
