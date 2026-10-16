/** Same-code WordLM on/off comparison of existing engineering references. */
import { writeFileSync } from 'node:fs';
import { dataset } from './eval/datasets';
import { correctText } from '../lib/editor/correct';

const report = { scope: 'Same-code ablation on existing assistant engineering references; not independent real-user accuracy',
  calibrationPerformed: false, datasets: {} as Record<string, unknown> };
for (const name of ['holdout-500', 'no-harm-2000']) {
  const rows = dataset(name).cases;
  let offExact=0, onExact=0, improved=0, regressed=0, changed=0;
  const changedIds: string[]=[];
  for (const row of rows) {
    const off=correctText(row.input,false,{useWordLM:false}).text;
    const on=correctText(row.input).text;
    offExact+=Number(off===row.expected); onExact+=Number(on===row.expected);
    improved+=Number(off!==row.expected && on===row.expected);
    regressed+=Number(off===row.expected && on!==row.expected);
    if(off!==on) { changed++;changedIds.push(row.id); }
  }
  report.datasets[name]={rows:rows.length,offExact,onExact,improved,regressed,changed,changedIds};
  if(regressed) process.exitCode=1;
}
writeFileSync('docs/training/wordlm-correction-ablation-2026-10-17.json',JSON.stringify(report,null,2)+'\n');
console.log(report);
