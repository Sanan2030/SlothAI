import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SlidingWindowLimiter } from '../lib/rate-limit';
import { transformationSchema } from '../lib/validation';
import { parseTransformationResponse } from '../lib/llm/response';
import { AppError } from '../lib/errors';

test('sliding window expires individual hits, not the entire bucket', () => {
  const limiter = new SlidingWindowLimiter(2, 1000);
  assert.equal(limiter.check('a', 0).allowed, true);
  assert.equal(limiter.check('a', 500).allowed, true);
  assert.equal(limiter.check('a', 999).allowed, false);
  assert.equal(limiter.check('b', 999).allowed, true);
  assert.equal(limiter.check('a', 1000).allowed, true);
  assert.equal(limiter.check('a', 1001).allowed, false);
  assert.equal(limiter.check('a', 1500).allowed, true);
});
test('limiter bounds memory and recovers after expiry', () => {
  const limiter = new SlidingWindowLimiter(2, 1000, 1);
  assert.equal(limiter.check('a', 0).allowed, true);
  assert.equal(limiter.check('b', 1).allowed, false);
  assert.equal(limiter.check('b', 1000).allowed, true);
});
test('validation rejects missing, whitespace, oversized and wrong-type inputs', () => {
  for (const value of [{}, { strategyId: '', text: 'a' }, { strategyId: 'a', text: ' \n ' },
    { strategyId: 'a', text: 42 }, { strategyId: 'a', text: 'a'.repeat(10_001) }]) {
    assert.equal(transformationSchema.safeParse(value).success, false);
  }
  assert.equal(transformationSchema.safeParse({ strategyId: 'a', text: 'ə'.repeat(10_000) }).success, true);
});
test('model JSON parsing supports fences and rejects malformed or invalid contracts', () => {
  assert.equal(parseTransformationResponse('```json\n{"transformedText":"Salam.","correctionsCount":1}\n```').transformedText, 'Salam.');
  for (const raw of ['not json', '{}', '[]', '{"transformedText":" ","correctionsCount":0}',
    '{"transformedText":"a","correctionsCount":-1}', '{"transformedText":"a","correctionsCount":"3"}']) {
    assert.throws(() => parseTransformationResponse(raw), AppError);
  }
});
