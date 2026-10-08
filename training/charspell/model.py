import torch
from torch import nn

# IDs 0=pad, 1=unknown; no hash vectors.
CHARACTERS = 'abcdefghijklmnopqrstuvwxyzəçğıöşü-\' '
CHAR_TO_ID = {char: index + 2 for index, char in enumerate(CHARACTERS)}


def encode(text, width):
    return [CHAR_TO_ID.get(char, 1) for char in text[:width]] + [0] * max(0, width - len(text))


class CharEncoder(nn.Module):
    def __init__(self, config):
        super().__init__()
        embedding, channels, output = config['charEmbedding'], config['charChannels'], config['wordEmbedding']
        self.embedding = nn.Embedding(len(CHAR_TO_ID) + 2, embedding, padding_idx=0)
        self.conv3 = nn.Conv1d(embedding, channels, 3, padding=1)
        self.conv5 = nn.Conv1d(embedding, channels, 5, padding=2)
        self.project = nn.Linear(channels * 2, output)

    def forward(self, chars):
        shape = chars.shape[:-1]
        flat = chars.reshape(-1, chars.shape[-1])
        valid = flat.ne(0).unsqueeze(1)
        embedded = self.embedding(flat).transpose(1, 2)
        def pool(conv):
            values = torch.relu(conv(embedded)).masked_fill(~valid, -1e4).amax(-1)
            return torch.where(valid.any(-1), values, torch.zeros_like(values))
        representation = torch.tanh(self.project(torch.cat([pool(self.conv3), pool(self.conv5)], -1)))
        return representation.reshape(*shape, -1)


class CharSpell(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.encoder = CharEncoder(config)
        width = config['wordEmbedding']
        self.score = nn.Sequential(nn.Linear(width * 5, width), nn.Tanh(), nn.Linear(width, 1))

    def forward(self, batch):
        candidate = self.encoder(batch['candidates'])
        size = candidate.shape[1]
        input_word = self.encoder(batch['input']).unsqueeze(1).expand(-1, size, -1)
        left = self.encoder(batch['left']).unsqueeze(1).expand(-1, size, -1)
        right = self.encoder(batch['right']).unsqueeze(1).expand(-1, size, -1)
        features = torch.cat([candidate, input_word, left, right, torch.abs(candidate - input_word)], -1)
        return self.score(features).squeeze(-1).masked_fill(~batch['mask'], -1e4)


def collate(rows, config, device):
    width = config['maxWordChars']
    count = max(len(row['candidates']) for row in rows)
    result = {key: torch.tensor([encode(row[key][-width:] if key == 'left' else row[key], width) for row in rows], dtype=torch.long, device=device)
              for key in ['input', 'left', 'right']}
    result['candidates'] = torch.tensor([[encode(word, width) for word in row['candidates']]
                                         + [[0] * width] * (count - len(row['candidates'])) for row in rows],
                                        dtype=torch.long, device=device)
    result['mask'] = torch.tensor([[True] * len(row['candidates']) + [False] * (count - len(row['candidates']))
                                   for row in rows], dtype=torch.bool, device=device)
    result['labels'] = torch.tensor([row['label'] for row in rows], dtype=torch.long, device=device)
    return result


def loss(logits, batch):
    return nn.functional.cross_entropy(logits, batch['labels'])


def measure(logits, batch, counters):
    labels = batch['labels']
    prediction = logits.argmax(-1)
    top = logits.topk(min(3, logits.shape[-1]), -1).indices
    counters['examples'] += len(labels)
    counters['top1Correct'] += int(prediction.eq(labels).sum())
    counters['top3Correct'] += int(top.eq(labels.unsqueeze(1)).any(1).sum())
    identity = labels.eq(0)  # identity candidate is explicitly first in every example.
    counters['identityExamples'] += int(identity.sum())
    counters['identityFalsePositives'] += int((identity & prediction.ne(0)).sum())


def summarize(counters):
    return {'top1Accuracy': counters['top1Correct'] / counters['examples'],
            'top3Accuracy': counters['top3Correct'] / counters['examples'],
            'identityFalsePositiveRate': counters['identityFalsePositives'] / counters['identityExamples']
            if counters['identityExamples'] else None,
            'scope': 'Synthetic source-split candidate scoring, conditional on retrieved target; not real correction quality.'}
