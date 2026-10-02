# Small local character/context attention network

This release adds a trained, local attention ranker for adjacent character swaps. It improves the editor's correction coverage while keeping the existing morphology, dictionary, protected spans, spelling head and agreement head. It is not a general language model and does not guarantee error-free text.

The architectural references are [ByT5](https://arxiv.org/abs/2105.13626), which studies robustness of character/byte-level representations to noise, and [Attention Is All You Need](https://research.google/pubs/attention-is-all-you-need/), which introduces the Transformer architecture. This implementation uses fixed signed character n-grams and a small learned scaled-dot-product context attention layer. It does not implement the full Transformer, reproduce ByT5, download pretrained weights or call an external AI API.

## Implementation

- Each candidate attends to up to five tokens on either side within the same sentence. Relative position channels distinguish left and right context. Unique reviewed morphological analyses normalize context words to their lemmas.
- A learned 16 × 16 query projection and 16 biases produce attention weights. A 71-input, 12-hidden-unit nonlinear classifier ranks the raw surface against bounded adjacent-swap candidates.
- The new head has 1,149 parameters; the existing networks have 795, for 1,944 total. Its artifact is 31,658 bytes. Inference uses ordinary TypeScript arrays on the CPU; no new dependency, model download, GPU or Python server is required.
- The spelling candidate vocabulary retains the existing learned lexicon and adds 32 canonical target words observed in training. This is a bounded candidate ranker, not a generator of arbitrary new sentences.
- Fold-identical alternatives such as `surət`/`sürət` require discriminative, lemma-normalized lexical context support in addition to the neural score and margin. Shared context words cannot justify a meaning-changing choice. When that evidence conflicts, the head abstains.
- Existing explicit diacritics, valid morphology, verb stems, protected terms, entities and code remain protected. The early swap pass runs after span/entity protection so that dictionary guesses cannot erase the original ambiguous input. Email and ordinary text share the same correction pipeline.

## Training and evaluation

The 128 authored examples are split into 80 training, 24 validation and 24 development test sentences. Training uses 190 candidate examples from the training partition only. Validation selects the checkpoint and acceptance threshold/margin; the retained checkpoint is epoch 32 of 512 attempted epochs. The full training history records discarded checkpoints. Exact typo observation features are disabled for this head so it must use character/context features rather than replaying input-output pairs.

A further 32 sentences are excluded from weight fitting, vocabulary fitting and threshold fitting. They were authored after the checkpoint was selected. Their evaluation revealed a wrong accepted meaning-changing correction, which motivated the conservative ambiguity guard. They therefore assess new sentence outputs, but are not an untouched blind final evaluation after all engineering decisions. Both corpora share lexical families with training, so their scores cannot establish open-domain semantic accuracy.

The combined 288-row audit across prior diversity/expansion data and these new corpora found no exact duplicates, near duplicates under the existing token-bigram threshold, or cross-split leaks. This audit does not prove semantic uniqueness.

| Evaluation | Previous main | This release |
| --- | ---: | ---: |
| Development text, exact full output | 17/24 | 24/24 |
| Development neural spelling, exact output | 10/24 | 24/24 |
| Additional authored text, exact full output | 21/32 | 27/32 |
| Wrong accepted attention choices, additional set | Not applicable | 0/19 |
| Existing lexical checks | 66/66 | 66/66 |
| Existing agreement checks | 50/50 | 50/50 |
| Existing challenge checks | 14/14 | 14/14 |
| Existing diversity text checks | 20/20 | 20/20 |
| Existing expansion text checks | 16/16 | 16/16 |

The five remaining additional-set failures are explicitly recorded in `data/neural/attention-independent-evaluation.json`. They involve document-copy/speed/city ambiguity in unfamiliar contexts. Some are left unchanged; another downstream dictionary stage can still produce an incorrect surface after this head abstains. Abstention is not equivalent to a fully correct final output. No existing correct baseline output regressed on either new set.

## Verification and reproduction

All 3,919 project tests passed, including numerical finite-difference gradient checks, deterministic resumed training, email/text integration, imperative preservation, valid-word controls and independent no-regression checks. TypeScript, ESLint and the production Next.js build passed. Both the old and new training artifacts were reproduced byte-for-byte; the old model weights remain unchanged. Local warm CPU p95 was 750 ms for 1,000 words and 6,286 ms for a 5,000-word document processed in five chunks, both under the requested 10 seconds. These measurements are not a Vercel latency guarantee. Detailed evidence is in `docs/neural-attention-verification.json`.

```sh
npm run neural:attention:train
npm run neural:attention:check
npm run neural:attention:independent:check
npm run neural:check
npm run neural:diversity:check
npm run neural:expansion:check
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:check
```

CI rebuilds and compares the committed attention artifact/report, then enforces development exact outputs and additional-set improvement, no baseline regressions and no wrong accepted attention choices. Independent failures remain visible in the committed evaluation report; the gate does not hide them behind a claim of perfect accuracy.

The next improvement needs a larger, independently reviewed corpus of real Azerbaijani errors and an untouched evaluation split. This small model still lacks general meaning comprehension and broad grammatical generation. Increasing synthetic sample counts alone does not establish those capabilities.
