import original from '../data/local-ai/pairs.json';
import additions from '../data/local-ai/paired-additions.json';
import artifact from '../lib/editor/local-ai/paired-model.json';
import posArtifact from '../lib/editor/local-ai/pos-model.json';
import { candidateIndex, rankPaired, alignTokens, normalizeDigraphs, wordLower, type CorrectionPair, type PairedModel } from '../lib/editor/local-ai/paired';
import { tokenize } from '../lib/editor/local-ai/core';
import { tagPOS, type POSModel } from '../lib/editor/local-ai/pos';
import { summarizeReliability, type ScoredObservation } from '../lib/editor/local-ai/reliability';
import { atomicWriteSync } from './atomic-files.mjs';
const model = artifact as PairedModel, index = candidateIndex(model);
const pairs: CorrectionPair[] = [...original.pairs, ...additions.rows.map(row => ({ ...row, groupId: row.group }))];
const reports = ['validation', 'test'].map(split => {
  const observations: ScoredObservation[] = [];
  let aligned = 0, corruptTokens = 0, missedCorruptTokens = 0, unchangedTokens = 0, changedCorrectTokens = 0;
  for (const pair of pairs.filter(row => row.split === split)) {
    const tokens = tokenize(pair.input), tags = tagPOS(posArtifact as POSModel, tokens.map(token => normalizeDigraphs(wordLower(token.word))));
    for (const row of alignTokens(pair)) {
      aligned++; const corrupt = row.raw !== row.target;
      if (corrupt) corruptTokens++; else unchangedTokens++;
      const result = rankPaired(model, index, row.raw, tokens, row.at, tags[row.at]?.tag);
      if (corrupt && (!result?.accepted || result.word !== row.target)) missedCorruptTokens++;
      if (!corrupt && result?.accepted) changedCorrectTokens++;
      if (result) observations.push({ score: result.probability, correct: result.word === row.target, accepted: result.accepted, group: pair.groupId });
    }
  }
  return { split, aligned, corruptTokens, missedCorruptTokens, unchangedTokens, changedCorrectTokens, ...summarizeReliability(observations) };
});
atomicWriteSync('data/local-ai/paired-reliability-report.json', JSON.stringify({ scope: 'Paired lexical ranker only; full editor evaluated separately', reports }, null, 2) + '\n');
console.log(JSON.stringify(reports.map(({ split, accepted, correct, wrong, acceptedGroups, groupWilsonLower95 }) => ({ split, accepted, correct, wrong, acceptedGroups, groupWilsonLower95 }))));
