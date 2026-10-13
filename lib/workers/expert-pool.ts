import type { InferenceStage, ModelProposal, PreparedInference } from '../editor/inference-cache';
import type { ExpertRequest, ExpertResponse } from './expert-protocol';
import { browserWorkerBudget } from './worker-budget';
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
  private disposed = false;
  private failed = new Set<InferenceStage>();
  constructor(private readonly factory: (stage: InferenceStage) => ExpertWorker, private readonly deadlineMs = 5_000) {}
  prepare(text: string): void {
    if (this.disposed || this.current?.text === text) return;
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
      if (this.disposed || this.failed.has(request.stage)) { resolve([]); return; }
      try {
        let slot = this.slots.get(request.stage);
        if (!slot) {
          const worker = this.factory(request.stage); slot = { worker }; this.slots.set(request.stage, slot);
          worker.onmessage = ({ data }) => {
            if (this.slots.get(request.stage) !== slot) return;
            if (slot!.active?.request.revision !== data.revision) return;
            if ('error' in data) { this.failStage(request.stage); return; }
            const task = slot!.active; clearTimeout(slot!.timer); slot!.active = undefined;
            task.resolve(data.proposals);
            const queued = slot!.queued; slot!.queued = undefined;
            if (queued) this.start(slot!, queued);
          };
          worker.onerror = worker.onmessageerror = () => this.failStage(request.stage);
        }
        const task = { request, resolve };
        if (slot.active) { slot.queued?.resolve([]); slot.queued = task; }
        else this.start(slot, task);
      } catch { resolve([]); this.failStage(request.stage); }
    });
  }
  private start(slot: Slot, task: Task): void {
    slot.active = task;
    slot.timer = setTimeout(() => this.failStage(task.request.stage), this.deadlineMs);
    try { slot.worker.postMessage(task.request); } catch { this.failStage(task.request.stage); }
  }
  private failStage(stage: InferenceStage): void {
    this.failed.add(stage);
    const slot = this.slots.get(stage);
    if (!slot) return;
    this.slots.delete(stage);
    clearTimeout(slot.timer); slot.worker.terminate(); slot.active?.resolve([]); slot.queued?.resolve([]);
  }
  dispose(): void {
    this.disposed = true;
    this.invalidate();
    for (const stage of [...this.slots.keys()]) this.failStage(stage);
  }
}

/** Small devices keep the existing single worker, avoiding duplicate dictionaries. */
export function supportsSpeculation(): boolean {
  return browserWorkerBudget().speculate;
}
