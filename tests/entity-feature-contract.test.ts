import test from 'node:test';
import assert from 'node:assert/strict';
import { isArtifactEntity, isCanonicalEntity } from '../lib/editor/entities/resolver';

test('runtime copular entities do not silently change frozen boundary features', () => {
  assert.equal(isCanonicalEntity('Bakıdır'), true);
  assert.equal(isArtifactEntity('Bakıdır'), false);
  for (const name of ['Bakı', 'Bakının', 'Azərbaycan', 'Azərbaycanın']) {
    assert.equal(isCanonicalEntity(name), true);
    assert.equal(isArtifactEntity(name), true);
  }
});
