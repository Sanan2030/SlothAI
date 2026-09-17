import { MODEL_ID } from './protocol';

export type ModelCacheState = 'checking' | 'cached' | 'missing' | 'unavailable';

export async function checkModelCache(): Promise<ModelCacheState> {
  if (typeof window === 'undefined' || !('caches' in globalThis)) return 'unavailable';
  try {
    // Checks the actual tensor manifest and every shard, not a localStorage flag.
    // This API reads the existing cache; it does not download model weights.
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    return await hasModelInCache(MODEL_ID) ? 'cached' : 'missing';
  } catch { return 'unavailable'; }
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    // Browsers may decline. Cache reuse still works without persistence, but
    // storage pressure or clearing site data can remove the downloaded model.
    if (navigator.storage?.persist && !await navigator.storage.persisted()) {
      await navigator.storage.persist();
    }
  } catch { /* Private browsing and restrictive storage policies are supported. */ }
}
