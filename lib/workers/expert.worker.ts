import { runExpert } from './expert-runner';
import type { ExpertRequest, ExpertResponse } from './expert-protocol';
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<ExpertRequest>) => void; postMessage: (response: ExpertResponse) => void };
// Serialize inside a worker. Browser scheduling provides parallelism between heads.
let pending = Promise.resolve();
scope.onmessage = ({ data }) => {
  pending = pending.then(async () => {
    try { scope.postMessage({ revision: data.revision, proposals: await runExpert(data) }); }
    catch (cause) { scope.postMessage({ revision: data.revision, error: cause instanceof Error ? cause.message : 'Ekspert işləmədi.' }); }
  });
};
