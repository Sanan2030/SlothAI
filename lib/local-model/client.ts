import { createWatchdog } from './watchdog';

let worker: Worker | undefined;
let ready = false;
let sequence = 0;
let pending: { id: number; resolve: (text: string) => void; reject: (error: Error) => void; progress?: (value: number) => void; watchdog: ReturnType<typeof createWatchdog> } | undefined;
const listeners = new Set<(status: string) => void>();
export function subscribeModelStatus(listener: (status: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isModelReady() { return ready; }

function modelError(message: string): Error {
  if (/disposed|device.*lost|device.*hung|out of memory/i.test(message)) {
    return new Error('Modelin GPU sessiyası bağlandı. Modeli yenidən yükləyin; xəta təkrarlanarsa brauzeri tam bağlayıb açın və digər GPU proqramlarını bağlayın.');
  }
  return new Error(message);
}

export function stopModel() {
  worker?.terminate();
  worker = undefined;
  ready = false;
  const current = pending;
  pending = undefined;
  current?.watchdog.clear();
  current?.reject(new Error('Əməliyyat dayandırıldı. Modeli yenidən yükləyə bilərsiniz.'));
}

function request(action: string, payload: Record<string, string>, progress?: (value: number) => void): Promise<string> {
  if (pending) return Promise.reject(new Error('Əvvəlki əməliyyatın bitməsini gözləyin.'));
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const watchdog = createWatchdog(action === 'load' ? 120_000 : 60_000, action === 'load' ? 900_000 : 600_000, () => {
      if (pending?.id !== id) return;
      pending = undefined;
      watchdog.clear();
      stopModel();
      reject(new Error('Əməliyyat vaxt həddini aşdı və dayandırıldı. Daha qısa mətnlə yenidən cəhd edin və ya sadə qaydalar rejimini seçin.'));
    });
    pending = { id, resolve, reject, progress, watchdog };
    try { worker!.postMessage({ id, action, ...payload }); }
    catch (cause) { watchdog.clear(); pending = undefined; reject(cause instanceof Error ? cause : new Error('Model sorğusu alınmadı.')); }
  });
}

export async function loadModel(progress: (value: number) => void) {
  if (ready) return;
  if (typeof window === 'undefined' || !('gpu' in navigator)) {
    throw new Error('Bu brauzerdə WebGPU yoxdur. Uyğun brauzer/cihaz və ya sadə qaydalar rejimini seçin.');
  }
  if (pending) throw new Error('Model artıq yüklənir.');
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const activeWorker = worker;
  worker.onmessage = event => {
    if (worker !== activeWorker || event.data.id !== pending?.id) return;
    const { progress: value, error, result, status } = event.data;
    pending?.watchdog.touch();
    if (typeof status === 'string') { listeners.forEach(listener => listener(status)); return; }
    if (typeof value === 'number') { pending?.progress?.(Math.min(1, Math.max(0, value))); return; }
    const current = pending!;
    pending = undefined;
    current.watchdog.clear();
    if (error) {
      // A failed engine may hold disposed GPU objects. Never reuse that worker.
      stopModel();
      current.reject(modelError(error));
    } else current.resolve(result);
  };
  worker.onerror = () => {
    if (worker !== activeWorker) return;
    const current = pending;
    pending = undefined;
    current?.watchdog.clear();
    stopModel();
    current?.reject(new Error('Model işə düşmədi. GPU yaddaşını və brauzer dəstəyini yoxlayın.'));
  };
  try {
    await request('load', {}, progress);
    if (worker !== activeWorker) throw new Error('Modelin yüklənməsi dayandırıldı.');
    ready = true;
  }
  catch (error) { if (worker === activeWorker) stopModel(); throw error; }
}

export async function generateLocally(prompt: string, text: string): Promise<string> {
  if (!ready || !worker) throw new Error('Əvvəlcə yerli modeli yükləyin.');
  if (!text.trim() || text.length > 10000) throw new Error('Mətn 1–10 000 simvol olmalıdır.');
  return request('transform', { prompt, text });
}
