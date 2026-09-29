/** Inventory, never promote machine output into an expected value automatically. */
import rsd from '../tests/fixtures/rsd-it-holdout.json';
import mail from '../tests/fixtures/email-holdout.json';
import reviewed from '../tests/fixtures/independent-reviewed.json';

const ids = new Set(reviewed.map(item => item.id));
const pending = [...rsd, ...mail].filter(item => !ids.has(item.id)).map(item => item.id);
console.log(JSON.stringify({ total: rsd.length + mail.length, manuallyReviewed: reviewed.length,
  pending: pending.length, pendingIds: pending }, null, 2));
if (process.argv.includes('--require-complete') && pending.length) process.exitCode = 1;
