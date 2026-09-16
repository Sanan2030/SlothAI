import { TextTransformationRegistry } from './registry';

let initialization: Promise<TextTransformationRegistry> | undefined;

async function initialize() {
  const registry = TextTransformationRegistry.getInstance();
  // Each route bundle initializes its own complete registry. Literal dynamic imports
  // let a new implementation require exactly ONE new line in this existing file.
  registry.register(new (await import('./impl/text-corrector')).AzerbaijaniTextCorrectorStrategy());
  registry.register(new (await import('./impl/gmail-corrector')).GmailCorrectorStrategy());
  return registry;
}

export function getRegistry(): Promise<TextTransformationRegistry> {
  initialization ??= initialize().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}
