import info from './model-info.json';
import { PunctCaseModel } from './core';

/** No Node/DOM dependency: identical integrity checks in a browser Worker and Node API. */
export async function decodePunctCase(data: string): Promise<PunctCaseModel> {
  if (data.length !== Math.ceil(info.bytes / 3) * 4) throw new Error('PunctCase faylının ölçüsü uyğun deyil.');
  const raw = atob(data), bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  if (bytes.length !== info.bytes) throw new Error('PunctCase faylının ölçüsü uyğun deyil.');
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== info.sha256) throw new Error('PunctCase faylının bütövlüyü yoxlamadan keçmədi.');
  const view = new DataView(bytes.buffer), values = new Float32Array(info.parameters);
  for (let at = 0; at < values.length; at++) values[at] = view.getFloat32(at * 4, true);
  return new PunctCaseModel(values);
}

let pending: Promise<PunctCaseModel> | undefined;
/** A failed lazy import can retry; successful immutable weights are shared within this Worker. */
export function loadPunctCase(): Promise<PunctCaseModel> {
  pending ??= import('./weights.json').then(artifact => decodePunctCase(artifact.default.data)).catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
