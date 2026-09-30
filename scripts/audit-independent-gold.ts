import additional from '../tests/fixtures/additional-gold-200.json';
/** Inventory, never promote machine output into an expected value automatically. */
import rsd from '../tests/fixtures/rsd-it-holdout.json';
import mail from '../tests/fixtures/email-holdout.json';
import reviewed from '../tests/fixtures/independent-reviewed.json';

import gold from '../tests/fixtures/independent-gold-v2.json';
const ids = new Set([...gold.cases, ...additional.cases].map(item => item.id));
if (ids.size !== gold.cases.length + additional.cases.length) throw new Error('Duplicate editorial target ids.');
const pending = [...rsd, ...mail, ...additional.cases].filter(item => !ids.has(item.id)).map(item => item.id);
console.log(JSON.stringify({ total: rsd.length + mail.length + additional.cases.length, legacyReviewed: reviewed.length, assistantReviewed: gold.cases.length + additional.cases.length, independentHumanCertification: false,
  pending: pending.length, pendingIds: pending }, null, 2));
if (process.argv.includes('--require-complete') && pending.length) process.exitCode = 1;
