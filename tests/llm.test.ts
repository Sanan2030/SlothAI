import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeLLMPrompt } from '../lib/llm/client';
import { AppError } from '../lib/errors';
import { AzerbaijaniTextCorrectorStrategy } from '../lib/strategies/impl/text-corrector';
import { GmailCorrectorStrategy } from '../lib/strategies/impl/gmail-corrector';

test('SDK request contract, both strategies, refusals and truncation', async () => {
  const originalFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-real-secret';
  let stopReason = 'end_turn';
  let captured: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    captured = JSON.parse(String(init?.body));
    return Response.json({ id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5',
      content: [{ type: 'text', text: '```json\n{"transformedText":"Salam.\\n\\n- Bir\\n- İki","correctionsCount":3}\n```' }],
      stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 20 } });
  };
  try {
    for (const strategy of [new AzerbaijaniTextCorrectorStrategy(), new GmailCorrectorStrategy()]) {
      const result = await strategy.transform({ text: 'salam bir iki' });
      assert.equal(result.metadata.correctionsMade, 3);
      assert.equal(result.metadata.strategyUsed, strategy.id);
      assert.match(result.transformedText, /Salam/);
    }
    assert.equal(captured.model, 'claude-sonnet-5');
    assert.deepEqual(captured.thinking, { type: 'disabled' });
    for (const key of ['temperature', 'top_p', 'top_k']) assert.equal(key in captured, false);
    stopReason = 'refusal';
    await assert.rejects(() => executeLLMPrompt('system', 'text'), (error: unknown) => error instanceof AppError && error.code === 'LLM_REFUSAL');
    stopReason = 'max_tokens';
    await assert.rejects(() => executeLLMPrompt('system', 'text'), (error: unknown) => error instanceof AppError && error.code === 'LLM_TRUNCATED');
  } finally { globalThis.fetch = originalFetch; delete process.env.ANTHROPIC_API_KEY; }
});
