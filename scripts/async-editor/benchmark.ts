import { EditorClient } from '../../lib/workers/editor-client';

type Trace = { id: number; start: number; end?: number };
function client(capacity: 1 | 2) {
  const traces: Trace[] = [];
  let workers = 0;
  const instance = new EditorClient(() => {
    workers++;
    const worker = new Worker('/editor.worker.js', { type: 'module' });
    const post = worker.postMessage.bind(worker);
    worker.postMessage = request => { traces.push({ id: request.id, start: performance.now() }); post(request); };
    worker.addEventListener('message', event => {
      const trace = traces.find(value => value.id === event.data.id && value.end === undefined);
      if (trace) trace.end = performance.now();
    });
    return worker;
  }, 60_000, { editorWorkers: capacity, speculate: false });
  return { instance, traces, workers: () => workers };
}
const sentence = 'bu gun yeni layiheni yoxladim ve butun senedleri hazirladim'.split(' ');
const makeText = (count: number) => Array.from({ length: count }, (_, at) => sentence[at % sentence.length]).join(' ');

async function benchmark() {
  const one = client(1), two = client(2);
  const text = makeText(900), mail = makeText(700);
  const timings: Record<string, number[]> = { serial: [], parallel: [] };
  const pair = async (which: ReturnType<typeof client>) => {
    const start = performance.now();
    const values = await Promise.all([
      which.instance.transform('text-corrector', { text }),
      which.instance.transform('gmail-corrector', { text: mail, options: { omitSubject: true, emailGreeting: 'Salam,' } }),
    ]);
    return { ms: performance.now() - start, output: values.map(value => value.transformedText) };
  };
  try {
    let expected: string[] | undefined;
    for (let warmup = 0; warmup < 4; warmup++) {
      const a = await pair(one), b = await pair(two);
      if (JSON.stringify(a.output) !== JSON.stringify(b.output)) throw new Error('Worker outputs differ');
      expected = a.output;
    }
    for (let round = 0; round < 9; round++) {
      for (const mode of round % 2 ? ['parallel', 'serial'] : ['serial', 'parallel']) {
        const value = await pair(mode === 'serial' ? one : two);
        if (JSON.stringify(value.output) !== JSON.stringify(expected)) throw new Error('Output changed');
        timings[mode].push(value.ms);
      }
    }
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const serial = median(timings.serial), parallel = median(timings.parallel);
    const overlapped = two.traces.some((left, at) => two.traces.slice(at + 1).some(right =>
      left.end !== undefined && right.end !== undefined && left.start < right.end && right.start < left.end));
    return { serialMedianMs: serial, parallelMedianMs: parallel, pairSpeedup: serial / parallel,
      timings, serialWorkers: one.workers(), parallelWorkers: two.workers(), overlapped,
      outputsIdentical: true, workload: { textWords: 900, mailWords: 700 },
      scope: 'Warm independent text/mail pairs; worker initialization and optional expert preparation excluded.' };
  } finally { one.instance.dispose(); two.instance.dispose(); }
}
(window as Window & { benchmark?: typeof benchmark }).benchmark = benchmark;
