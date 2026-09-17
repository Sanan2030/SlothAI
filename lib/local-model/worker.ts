import { CreateMLCEngine, type MLCEngine } from '@mlc-ai/web-llm';
import { MODEL_ID, readCompletion, splitModelInput } from './protocol';

let engine: MLCEngine | undefined;
globalThis.onmessage = async (event: MessageEvent) => {
  const { id, action, prompt, text } = event.data;
  try {
    if (action === 'load') {
      engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: report => globalThis.postMessage({ id, progress: report.progress }),
      }, { context_window_size: 4096 });
      globalThis.postMessage({ id, result: 'ready' });
    } else {
      if (!engine) throw new Error('Əvvəlcə modeli yükləyin.');
      const chunks = splitModelInput(text);
      const results: string[] = [];
      for (let index = 0; index < chunks.length; index++) {
        globalThis.postMessage({ id, status: `Hissə ${index + 1}/${chunks.length}: emal başlayır…` });
        const partInstruction = chunks.length > 1
          ? `\nThis is part ${index + 1} of ${chunks.length} of one document. Correct only this part. If formatting an email, include subject and salutation ONLY in part 1 and sign-off ONLY in the last part. Never summarize omitted parts.` : '';
        const stream = await engine.chat.completions.create({
          messages: [{ role: 'system', content: prompt + partInstruction }, { role: 'user', content: chunks[index] }],
          extra_body: { enable_thinking: false }, stream: true,
          temperature: 0.7, top_p: 0.8, max_tokens: 1800,
        });
        let content = '', reason: string | null = null, lastReport = 0;
        for await (const response of stream) {
          const choice = response.choices[0];
          content += choice?.delta.content ?? '';
          if (choice?.finish_reason) reason = choice.finish_reason;
          if (Date.now() - lastReport > 500) {
            globalThis.postMessage({ id, status: `Hissə ${index + 1}/${chunks.length}: ${content.length} simvol hazırlanıb` });
            lastReport = Date.now();
          }
        }
        results.push(readCompletion(content, reason));
        await engine.resetChat();
      }
      globalThis.postMessage({ id, result: results.join('\n\n') });
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
