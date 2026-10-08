import torch
from torch import nn
from training.charspell.model import CharEncoder, encode
from training.text import PUNCTUATION, CASES


class PunctCase(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.encoder = CharEncoder(config)
        hidden = config['taggerHidden']
        self.context = nn.GRU(config['wordEmbedding'], hidden, batch_first=True, bidirectional=True)
        self.punctuation = nn.Linear(hidden * 2, len(PUNCTUATION))
        self.case = nn.Linear(hidden * 2, len(CASES))

    def forward(self, batch):
        words = self.encoder(batch['words'])
        packed = nn.utils.rnn.pack_padded_sequence(words, batch['lengths'], batch_first=True, enforce_sorted=False)
        result, _ = self.context(packed)
        context, _ = nn.utils.rnn.pad_packed_sequence(result, batch_first=True, total_length=words.shape[1])
        return self.punctuation(context), self.case(context)


def collate(rows, config, device):
    width, length = config['maxWordChars'], max(len(row['words']) for row in rows)
    if not length or any(not row['words'] for row in rows):
        raise ValueError('Empty tagger sequence')
    return {'words': torch.tensor([[encode(word, width) for word in row['words']]
                                    + [[0] * width] * (length - len(row['words'])) for row in rows], device=device),
            'lengths': torch.tensor([len(row['words']) for row in rows]),
            **{key: torch.tensor([row[key] + [-100] * (length - len(row[key])) for row in rows], device=device)
               for key in ['punctuation', 'case']}}


def loss(logits, batch):
    values = []
    for output, key in zip(logits, ['punctuation', 'case']):
        if batch[key].ne(-100).any():
            values.append(nn.functional.cross_entropy(output.flatten(0, 1), batch[key].flatten(), ignore_index=-100))
    if not values:
        raise ValueError('Batch contains no unprotected supervised tagger labels')
    return sum(values)


def measure(logits, batch, counters):
    counters['examples'] += len(batch['words'])
    for output, key in zip(logits, ['punctuation', 'case']):
        valid = batch[key].ne(-100)
        counters[key + 'Labels'] += int(valid.sum())
        counters[key + 'Correct'] += int((output.argmax(-1).eq(batch[key]) & valid).sum())
    predicted, actual = logits[0].argmax(-1), batch['punctuation']
    valid = actual.ne(-100)
    counters['punctuationTruePositive'] += int((predicted.eq(actual) & actual.ne(0) & valid).sum())
    counters['punctuationPredictedPositive'] += int((predicted.ne(0) & valid).sum())
    counters['punctuationActualPositive'] += int((actual.ne(0) & valid).sum())


def summarize(counters):
    denominator = counters['punctuationPredictedPositive'] + counters['punctuationActualPositive']
    return {'punctuationAccuracy': counters['punctuationCorrect'] / counters['punctuationLabels']
            if counters['punctuationLabels'] else None,
            'caseAccuracy': counters['caseCorrect'] / counters['caseLabels'] if counters['caseLabels'] else None,
            'punctuationMicroF1': 2 * counters['punctuationTruePositive'] / denominator if denominator else None,
            'scope': 'Mechanically filtered source-split clean-text labels, excluding protected/ambiguous labels; not human-reviewed quality.'}
