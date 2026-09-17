let worker: Worker | undefined;
let ready = false;
let sequence = 0;
let pending: { id: number; resolve: (text: string) => void; reject: (error: Error) => void; progress?: (value: number) => void } | undefined;

export function stopModel() {
  worker?.terminate();
  worker = undefined;
  ready = false;
  const current = pending;
  pending = undefined;
  current?.reject(new Error('Əməliyyat dayandırıldı. Modeli yenidən yükləyə bilərsiniz.'));
}

function request(action: string, payload: Record<string, string>, progress?: (value: number) => void): Promise<string> {
  if (pending) return Promise.reject(new Error('Əvvəlki əməliyyatın bitməsini gözləyin.'));
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending = { id, resolve, reject, progress };
    try { worker!.postMessage({ id, action, ...payload }); }
    catch (cause) { pending = undefined; reject(cause instanceof Error ? cause : new Error('Model sorğusu alınmadı.')); }
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
    const { progress: value, error, result } = event.data;
    if (typeof value === 'number') { pending?.progress?.(Math.min(1, Math.max(0, value))); return; }
    const current = pending!;
    pending = undefined;
    if (error) current.reject(new Error(error)); else current.resolve(result);
  };
  worker.onerror = () => {
    if (worker !== activeWorker) return;
    const current = pending;
    pending = undefined;
    stopModel();
    current?.reject(new Error('Model işə düşmədi. GPU yaddaşını və brauzer dəstəyini yoxlayın.'));
  };
  try { await request('load', {}, progress); ready = true; }
  catch (error) { if (worker === activeWorker) stopModel(); throw error; }
}

export async function generateLocally(prompt: string, text: string): Promise<string> {
  if (!ready || !worker) throw new Error('Əvvəlcə yerli modeli yükləyin.');
  if (!text.trim() || text.length > 10000) throw new Error('Mətn 1–10 000 simvol olmalıdır.');
  return request('transform', { prompt, text });
}
