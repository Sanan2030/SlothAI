import assert from 'node:assert/strict';
import test from 'node:test';

import { correctText } from '../lib/editor/correct';
import {
  PROTECTED_TERMINOLOGY,
  PROTECTED_TERMS,
  canonicalProtectedTerm,
  protectKnownTerminology,
} from '../lib/editor/protected-terminology';

test('protected terminology registry contains core programming, infrastructure and banking terms', () => {
  for (const term of [
    'API', 'Java', 'Next.js', 'Vercel', 'GitHub',
    'IBAN', 'SWIFT', 'OTP', 'KYC', 'AML', 'PCI DSS', 'ISO 20022',
  ]) {
    assert.ok(PROTECTED_TERMS.includes(term), `missing protected term: ${term}`);
  }

  assert.ok(PROTECTED_TERMINOLOGY.programming.length >= 20);
  assert.ok(PROTECTED_TERMINOLOGY.infrastructure.length >= 20);
  assert.ok(PROTECTED_TERMINOLOGY.banking.length >= 20);
});

test('protected terminology canonicalizes reviewed casing', () => {
  assert.equal(canonicalProtectedTerm('api'), 'API');
  assert.equal(canonicalProtectedTerm('github'), 'GitHub');
  assert.equal(canonicalProtectedTerm('vercel'), 'Vercel');
  assert.equal(canonicalProtectedTerm('iban'), 'IBAN');
  assert.equal(canonicalProtectedTerm('swift'), 'SWIFT');
  assert.equal(canonicalProtectedTerm('kyc'), 'KYC');
  assert.equal(canonicalProtectedTerm('pci dss'), 'PCI DSS');
});

test('protected terminology supports multi-word and symbol-heavy terms', () => {
  const seen: string[] = [];
  const protectedText = protectKnownTerminology(
    'next.js spring boot ci/cd open banking iso 20022 c# c++',
    (value) => {
      seen.push(value);
      return `<${value}>`;
    },
  );

  assert.deepEqual(seen, [
    'Next.js',
    'Spring Boot',
    'CI/CD',
    'Open Banking',
    'ISO 20022',
    'C#',
    'C++',
  ]);
  assert.equal(
    protectedText,
    '<Next.js> <Spring Boot> <CI/CD> <Open Banking> <ISO 20022> <C#> <C++>',
  );
});

test('editor preserves protected IT and banking terminology while correcting Azerbaijani text', () => {
  assert.equal(
    correctText('api ve github ile iban yoxlanilir').text,
    'API və GitHub ilə IBAN yoxlanılır.',
  );

  assert.equal(
    correctText('kyc ve aml prosesi core banking sisteminde isleyir').text,
    'KYC və AML prosesi Core Banking sistemində işləyir.',
  );
});
