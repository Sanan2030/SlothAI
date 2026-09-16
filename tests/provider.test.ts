import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { getProvider, UnsupportedProviderError } from '../lib/llm/provider';
import { GET } from '../app/api/strategies/route';
import { POST } from '../app/api/transform/route';

const source = 'salam necesen mende yaxsiyam amma bu aralar pisem';
const corrected = 'Salam, necəsən? Mən də yaxşıyam, amma bu aralar pisəm.';
function request() {
  return new NextRequest('http://localhost/api/transform', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategyId: 'text-corrector', text: source }),
  });
}

test('provider normalization and both route responses', async () => {
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let lastUrl = '';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.OPENAI_API_KEY = 'test-placeholder';
  process.env.ANTHROPIC_API_KEY = 'test-placeholder';
  globalThis.fetch = async (input) => {
    calls++;
    lastUrl = String(input);
    const content = JSON.stringify({ transformedText: corrected, correctionsCount: 6 });
    return Response.json(lastUrl.includes('anthropic')
      ? { content: [{ type: 'text', text: content }] }
      : { choices: [{ message: { content } }] });
  };
  try {
    for (const value of [undefined, '', '   ', '\n\t', 'openai', ' OPENAI ']) {
      if (value === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = value;
      assert.equal(getProvider(), 'openai');
      assert.equal((await GET()).status, 200);
      const response = await POST(request());
      assert.equal(response.status, 200);
      assert.equal((await response.json()).transformedText, corrected);
      assert.match(lastUrl, /api.openai.com/);
    }
    process.env.LLM_PROVIDER = ' AnThRoPiC ';
    assert.equal(getProvider(), 'anthropic');
    assert.equal((await GET()).status, 200);
    assert.equal((await POST(request())).status, 200);
    assert.match(lastUrl, /api.anthropic.com/);
    process.env.LLM_PROVIDER = 'unsupported';
    assert.throws(() => getProvider(), UnsupportedProviderError);
    const countBefore = calls;
    for (const response of [await GET(), await POST(request())]) {
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, 'UNSUPPORTED_LLM_PROVIDER');
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(calls, countBefore, 'Invalid provider must not call an LLM');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
