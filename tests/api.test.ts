import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/transform/route';
import { GET } from '../app/api/strategies/route';
import { getRegistry } from '../lib/strategies/bootstrap';

let id = 0;
function request(body: string, ip = `test-${++id}`) {
  return new NextRequest('http://localhost/api/transform', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip, 'x-vercel-forwarded-for': ip }, body });
}
test('transform route initializes registry without first visiting strategy endpoint', async () => {
  const result = await POST(request(JSON.stringify({ strategyId: 'missing', text: 'salam' })));
  assert.equal(result.status, 400);
  assert.equal((await result.json()).error.code, 'UNKNOWN_STRATEGY');
  const registries = await Promise.all(Array.from({ length: 8 }, () => getRegistry()));
  assert.ok(registries.every(registry => registry === registries[0]));
  const list = await (await GET()).json();
  assert.deepEqual(list.strategies.map((s: { id: string }) => s.id), ['text-corrector', 'gmail-corrector']);
});
test('malformed JSON, validation failures and oversized bodies return clear 400s', async () => {
  for (const [body, code] of [['{', 'INVALID_JSON'], ['{}', 'VALIDATION_ERROR'], ['x'.repeat(100_001), 'BODY_TOO_LARGE']]) {
    const result = await POST(request(body));
    assert.equal(result.status, 400);
    assert.equal((await result.json()).error.code, code);
  }
});
test('rate limiting runs before JSON parsing and returns retry headers', async () => {
  for (let count = 0; count < 10; count++) assert.equal((await POST(request('{', 'limited'))).status, 400);
  const result = await POST(request('{', 'limited'));
  assert.equal(result.status, 429);
  assert.ok(Number(result.headers.get('Retry-After')) > 0);
});
test('missing API key produces a controlled configuration error', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const result = await POST(request(JSON.stringify({ strategyId: 'text-corrector', text: 'salam' })));
  assert.equal(result.status, 500);
  assert.equal((await result.json()).error.code, 'CONFIGURATION_ERROR');
});
