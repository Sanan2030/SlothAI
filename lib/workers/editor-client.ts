import { ExpertPool, type ExpertWorker } from './expert-pool';
import { browserWorkerBudget } from './worker-budget';
import type { TransformationRequest, TransformationResult } from '../strategies/types';
import type { EditorWorkerRequest, EditorWorkerResponse } from './editor-protocol';
export interface EditorWorker {
  onmessage: ((event: MessageEvent<EditorWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<EditorWorkerResponse>) => void) | null;
  postMessage(value: EditorWorkerRequest): void;
  terminate(): void;
}
export interface EditorClientOptions {
  editorWorkers?: 1 | 2;
  speculate?: boolean;
  expertFactory?: () => ExpertWorker;
}
interface Task {
  id: number;
  strategyId: string;
  request: TransformationRequest;
  resolve: (value: TransformationResult) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}
interface Slot { worker: EditorWorker; active?: Task }
export const EDITOR_TIMEOUT_MS = 10 * 60 * 1000;
export const MAX_QUEUED_EDITOR_TASKS = 4;

/** Independent documents run in bounded workers; each document retains its full context. */
export class EditorClient {
  private readonly slots = new Set<Slot>();
  private readonly queue: Task[] = [];
  private readonly capacity: 1 | 2;
  private readonly speculate: boolean;
  private readonly expertFactory: () => ExpertWorker;
  private experts?: ExpertPool;
  private sequence = 0;
  private draining = false;
  constructor(private readonly factory: () => EditorWorker = () => new Worker(new URL('./editor.worker.ts', import.meta.url), { type: 'module' }),
    private readonly timeoutMs = EDITOR_TIMEOUT_MS, options: EditorClientOptions = {}) {
    const budget = browserWorkerBudget();
    this.capacity = options.editorWorkers ?? budget.editorWorkers;
    this.speculate = options.speculate ?? budget.speculate;
    this.expertFactory = options.expertFactory ?? (() => new Worker(new URL('./expert.worker.ts', import.meta.url), { type: 'module' }));
  }
  /** Debounced by the UI: warm model imports and prepare heads before an explicit click. */
  prepare(text: string): void {
    if (!text.trim() || text.length > 10_000) return;
    try { while (this.slots.size < this.capacity) this.createSlot(); } catch { /* An explicit request can retry initialization. */ }
    if (!this.speculate || [...this.slots].filter(slot => slot.active).length >= this.capacity) return;
    this.experts ??= new ExpertPool(this.expertFactory);
    this.experts.prepare(text);
  }
  invalidatePreparation(): void { this.experts?.invalidate(); }
  transform(strategyId: string, request: TransformationRequest): Promise<TransformationResult> {
    if (this.queue.length >= MAX_QUEUED_EDITOR_TASKS) {
      return Promise.reject(new Error('Düzəliş növbəsi doludur. Bir işin bitməsini gözləyib yenidən cəhd edin.'));
    }
    return new Promise((resolve, reject) => {
      // Waiting callers cannot mutate another task's text/options before dispatch.
      this.queue.push({ id: ++this.sequence, strategyId,
        request: { text: request.text, ...(request.options ? { options: { ...request.options } } : {}) }, resolve, reject });
      this.drain();
    });
  }
  private createSlot(): Slot {
    const slot: Slot = { worker: this.factory() };
    this.slots.add(slot);
    slot.worker.onmessage = ({ data }) => {
      const task = slot.active;
      if (!this.slots.has(slot) || !task || data.id !== task.id) return;
      clearTimeout(task.timer); slot.active = undefined;
      if ('error' in data) task.reject(new Error(data.error)); else task.resolve(data.result);
      this.drain();
    };
    slot.worker.onerror = slot.worker.onmessageerror = () =>
      this.failSlot(slot, new Error('Yerli mühərrik açılmadı. Yenidən cəhd edin.'));
    return slot;
  }
  private drain(): void {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        let slot = [...this.slots].find(value => !value.active);
        if (!slot && this.slots.size >= this.capacity) break;
        const task = this.queue.shift()!;
        try {
          slot ??= this.createSlot();
          slot.active = task;
          const deadline = this.timeoutMs % 60_000 === 0 ? `${this.timeoutMs / 60_000} dəqiqə` : `${Math.ceil(this.timeoutMs / 1000)} saniyə`;
          task.timer = setTimeout(() => this.failSlot(slot!, new Error(`Emal ${deadline} həddini keçdi. Mətni kiçik hissələrə bölüb yenidən cəhd edin.`)), this.timeoutMs);
          const prepared = this.experts?.snapshot(task.request.text);
          slot.worker.postMessage({ id: task.id, strategyId: task.strategyId, request: task.request, ...(prepared ? { prepared } : {}) });
        } catch (cause) {
          const error = new Error(cause instanceof Error ? cause.message : 'Yerli mühərrik açılmadı.');
          if (slot) this.failSlot(slot, error); else task.reject(error);
        }
      }
    } finally { this.draining = false; }
  }
  private failSlot(slot: Slot, error: Error): void {
    if (!this.slots.delete(slot)) return;
    clearTimeout(slot.active?.timer);
    slot.active?.reject(error); slot.active = undefined;
    slot.worker.terminate();
    this.drain();
  }
  dispose(message = 'Düzəliş dayandırıldı.'): void {
    this.experts?.dispose(); this.experts = undefined;
    const error = new Error(message);
    for (const task of this.queue.splice(0)) task.reject(error);
    const slots = [...this.slots];
    this.slots.clear();
    for (const slot of slots) {
      clearTimeout(slot.active?.timer);
      slot.active?.reject(error); slot.active = undefined;
      slot.worker.terminate();
    }
  }
}
