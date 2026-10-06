import type { InferenceStage, ModelProposal, PreparedInference } from '../editor/inference-cache';
import type { ExpertRequest, ExpertResponse } from './expert-protocol';
export interface ExpertWorker {
  onmessage: ((event: MessageEvent<ExpertResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(value: ExpertRequest): void;
  terminate(): void;
}
interface Task { request: ExpertRequest; resolve: (value: ModelProposal[]) => void }
interface Slot { worker: ExpertWorker; active?: Task; queued?: Task; timer?: ReturnType<typeof setTimeout> }

/** Two specialized workers, one running + one latest queued job per head. */
export class ExpertPool {
  private revision = 0;
  private current?: PreparedInference;
  private slots = new Map<InferenceStage, Slot>();
  private disabled = false;
  constructor(private readonly factory: (stage: InferenceStage) => ExpertWorker, private readonly deadlineMs = 5_000) {}
  prepare(text: string): void {
    if (this.disabled || this.current?.text === text) return;
    const revision = ++this.revision;
    this.current = { revision, text, proposals: [] };
    if (!text.trim() || text.length > 10_000) return;
    for (const stage of ['log-spelling', 'sentence-boundary'] as const) {
      void this.schedule({ revision, text, stage }).then(proposals => {
        if (this.current?.revision === revision) this.current.proposals.push(...proposals);
      });
    }
  }
  snapshot(text: string): PreparedInference | undefined {
    const current = this.current;
    return current?.text === text && current.proposals.length ? { ...current, proposals: [...current.proposals] } : undefined;
  }
  invalidate(): void {
    this.revision++; this.current = undefined;
    for (const slot of this.slots.values()) { slot.queued?.resolve([]); slot.queued = undefined; }
  }
  private schedule(request: ExpertRequest): Promise<ModelProposal[]> {
    return new Promise(resolve => {
      try {
        let slot = this.slots.get(request.stage);
        if (!slot) {
          const worker = this.factory(request.stage); slot = { worker }; this.slots.set(request.stage, slot);
          worker.onmessage = ({ data }) => {
            if (slot!.active?.request.revision !== data.revision) return;
            const task = slot!.active; clearTimeout(slot!.timer); slot!.active = undefined;
            task.resolve('proposals' in data ? data.proposals : []);
            const queued = slot!.queued; slot!.queued = undefined;
            if (queued) this.start(slot!, queued);
          };
          worker.onerror = worker.onmessageerror = () => this.stop();
        }
        const task = { request, resolve };
        if (slot.active) { slot.queued?.resolve([]); slot.queued = task; }
        else this.start(slot, task);
      } catch { resolve([]); this.stop(); }
    });
  }
  private start(slot: Slot, task: Task): void {
    slot.active = task;
    slot.timer = setTimeout(() => this.stop(), this.deadlineMs);
    try { slot.worker.postMessage(task.request); } catch { this.stop(); }
  }
  private stop(): void {
    this.disabled = true;
    for (const slot of this.slots.values()) {
      clearTimeout(slot.timer); slot.worker.terminate(); slot.active?.resolve([]); slot.queued?.resolve([]);
    }
    this.slots.clear(); this.current = undefined;
  }
  dispose(): void { this.invalidate(); this.stop(); }
}

/** Small devices keep the existing single worker, avoiding duplicate dictionaries. */
export function supportsSpeculation(): boolean {
  return typeof Worker !== 'undefined' && typeof navigator !== 'undefined'
    && navigator.hardwareConcurrency >= 4
    && !(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
}
