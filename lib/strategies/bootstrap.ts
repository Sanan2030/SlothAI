import { GmailCorrectorStrategy } from './impl/gmail-corrector';
import { AzerbaijaniTextCorrectorStrategy } from './impl/text-corrector';
import { TextTransformationRegistry } from './registry';

const registry = TextTransformationRegistry.getInstance();

if (!registry.has('text-corrector')) {
  registry.register(new AzerbaijaniTextCorrectorStrategy());
}

if (!registry.has('gmail-corrector')) {
  registry.register(new GmailCorrectorStrategy());
}

export function getStrategyRegistry() {
  return registry;
}
