import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldSubmitEditorKey } from '../lib/ui/editor-keys';

test('plain Enter submits correction', () => {
  assert.equal(shouldSubmitEditorKey({ key: 'Enter' }), true);
});

test('Shift+Enter keeps a line break', () => {
  assert.equal(shouldSubmitEditorKey({ key: 'Enter', shiftKey: true }), false);
});

test('IME composition never submits', () => {
  assert.equal(shouldSubmitEditorKey({ key: 'Enter', isComposing: true }), false);
});

test('other keys do not submit', () => {
  assert.equal(shouldSubmitEditorKey({ key: 'a' }), false);
});
