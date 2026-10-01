/** Diagnostics only: a logistic score is not a calibrated success probability. */
export interface ScoredObservation { score: number; correct: boolean; accepted: boolean; group: string }
export function wilsonLower(correct: number, total: number): number | null {
  if (!total) return null;
  const z = 1.959963984540054, p = correct / total;
  return (p + z * z / (2 * total) - z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total))) / (1 + z * z / total);
}
export function summarizeReliability(rows: readonly ScoredObservation[]) {
  const accepted = rows.filter(row => row.accepted);
  const correct = accepted.filter(row => row.correct).length;
  const groups = new Map<string, boolean>();
  for (const row of accepted) groups.set(row.group, (groups.get(row.group) ?? true) && row.correct);
  const successfulGroups = [...groups.values()].filter(Boolean).length;
  const bins = Array.from({ length: 5 }, (_, at) => {
    const lower = at / 5, upper = (at + 1) / 5;
    const values = rows.filter(row => row.score >= lower && (at === 4 ? row.score <= upper : row.score < upper));
    return { lower, upper, count: values.length,
      meanScore: values.length ? values.reduce((sum, row) => sum + row.score, 0) / values.length : null,
      empiricalAccuracy: values.length ? values.filter(row => row.correct).length / values.length : null };
  });
  return { proposals: rows.length, accepted: accepted.length, correct, wrong: accepted.length - correct,
    abstained: rows.length - accepted.length, precision: accepted.length ? correct / accepted.length : null,
    acceptedGroups: groups.size, allCorrectGroups: successfulGroups,
    groupWilsonLower95: wilsonLower(successfulGroups, groups.size),
    proposalBrier: rows.length ? rows.reduce((sum, row) => sum + (row.score - Number(row.correct)) ** 2, 0) / rows.length : null,
    bins, caveat: 'Scores are uncalibrated. Brier/bins measure proposal correctness only; abstained/no-candidate tokens are excluded. Repeated variants are correlated. Group Wilson bounds are descriptive, not a general-language guarantee.' };
}
