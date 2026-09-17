import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';
import { MODEL_ID, readCompletion } from './protocol';

let engine: MLCEngine | undefined;
globalThis.onmessage = async (event: MessageEvent) => {
  const { id, action, prompt, text } = event.data;
  try {
    if (action === 'load') {
      engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: report => globalThis.postMessage({ id, progress: report.progress }),
      }, { context_window_size: 32768 });
      globalThis.postMessage({ id, result: 'ready' });
    } else {
      if (!engine) throw new Error('Əvvəlcə modeli yükləyin.');
      const response = await engine.chat.completions.create({
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: text }],
        extra_body: { enable_thinking: false },
        temperature: 0.7, top_p: 0.8, max_tokens: 8192,
      });
      const choice = response.choices[0];
      const result = readCompletion(choice?.message.content, choice?.finish_reason ?? null);
      await engine.resetChat();
      globalThis.postMessage({ id, result });
    }
  } catch (cause) {
    // Keep source text out of diagnostics; inference errors happen in the browser,
    // so these records appear in DevTools rather than Vercel function logs.
    console.error('[local-model]', { stage: action, name: cause instanceof Error ? cause.name : 'UnknownError',
      disposed: cause instanceof Error && /disposed|device.*lost/i.test(cause.message) });
    engine = undefined;
    globalThis.postMessage({ id, error: cause instanceof Error ? cause.message : 'Yerli model xətası.' });
  }
};
