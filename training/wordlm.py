"""Disk-backed interpolated Kneser-Ney 3-gram with explicit suffix-class OOV backoff."""
from collections import Counter
import functools
import math
from pathlib import Path
import sqlite3
import time

from training.common import jsonl, model_card, sha256, write_json
from training.text import suffix_class


def add_ngrams(db, counts):
    for name, values in counts.items():
        if not values:
            continue
        columns = {'bigrams': 'a,b', 'trigrams': 'a,b,c'}[name]
        placeholders = ','.join('?' for _ in range(len(columns.split(',')) + 1))
        db.executemany(f'INSERT INTO {name} VALUES ({placeholders}) '
                       f'ON CONFLICT({columns}) DO UPDATE SET n=n+excluded.n',
                       ((*words, n) for words, n in values.items()))
        values.clear()
    db.commit()


def build(path, sentences, vocabulary, discount=0.75):
    if not 0 < discount < 1:
        raise ValueError('Kneser-Ney discount must be in (0,1)')
    db = sqlite3.connect(path)
    db.execute('PRAGMA cache_size=-32768')
    db.execute('CREATE TABLE vocabulary(word TEXT PRIMARY KEY) WITHOUT ROWID')
    db.executemany('INSERT INTO vocabulary VALUES (?)', ((word,) for word in sorted(vocabulary)))
    db.execute('CREATE TABLE settings(discount REAL)')
    db.execute('INSERT INTO settings VALUES (?)', (discount,))
    db.execute('CREATE TABLE bigrams(a TEXT,b TEXT,n INTEGER,PRIMARY KEY(a,b)) WITHOUT ROWID')
    db.execute('CREATE TABLE trigrams(a TEXT,b TEXT,c TEXT,n INTEGER,PRIMARY KEY(a,b,c)) WITHOUT ROWID')
    counts = {'bigrams': Counter(), 'trigrams': Counter()}
    rows, token_count = 0, 0
    def mapped(word):
        return word if word in vocabulary else suffix_class(word)
    for words in sentences:
        rows += 1
        sequence = ['<s>', '<s>', *map(mapped, words), '</s>']
        token_count += len(words) + 1
        # Do not count the artificial <s>→<s> transition as an output word.
        for at in range(2, len(sequence)):
            counts['bigrams'][tuple(sequence[at - 1:at + 1])] += 1
            counts['trigrams'][tuple(sequence[at - 2:at + 1])] += 1
        if sum(map(len, counts.values())) >= 30000:
            add_ngrams(db, counts)
    add_ngrams(db, counts)
    if not token_count:
        raise ValueError('Cannot train a WordLM on an empty dataset')
    # Continuation lower-order counts are distinct left contexts, not raw bigram counts.
    db.execute('CREATE TABLE contexts3 AS SELECT a,b,SUM(n) AS total,COUNT(*) AS types FROM trigrams GROUP BY a,b')
    db.execute('CREATE UNIQUE INDEX contexts3_key ON contexts3(a,b)')
    db.execute('CREATE TABLE continuation2 AS SELECT b AS a,c AS b,COUNT(*) AS n FROM trigrams GROUP BY b,c')
    db.execute('CREATE UNIQUE INDEX continuation2_key ON continuation2(a,b)')
    db.execute('CREATE TABLE contexts2 AS SELECT a,SUM(n) AS total,COUNT(*) AS types FROM continuation2 GROUP BY a')
    db.execute('CREATE UNIQUE INDEX contexts2_key ON contexts2(a)')
    db.execute('CREATE TABLE continuation1 AS SELECT b AS word,COUNT(*) AS n FROM bigrams GROUP BY b')
    db.execute('CREATE UNIQUE INDEX continuation1_key ON continuation1(word)')
    db.commit()
    db.execute('VACUUM')
    db.close()
    return rows, token_count


class WordLM:
    def __init__(self, path):
        self.db = sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)
        self.vocabulary = {row[0] for row in self.db.execute('SELECT word FROM vocabulary')}
        self.discount = self.db.execute('SELECT discount FROM settings').fetchone()[0]
        self.total = self.db.execute('SELECT SUM(n) FROM continuation1').fetchone()[0]
        self.output_classes = {row[0] for row in self.db.execute('SELECT word FROM continuation1')}

    def mapped(self, word):
        if word in self.vocabulary or word in ('<s>', '</s>'):
            return word
        proposed = suffix_class(word)
        return proposed if proposed in self.output_classes else '<unk>'

    @functools.lru_cache(maxsize=32768)
    def unigram(self, word):
        row = self.db.execute('SELECT n FROM continuation1 WHERE word=?', (word,)).fetchone()
        return (row[0] / self.total) if row else 0.0

    @functools.lru_cache(maxsize=32768)
    def bigram(self, previous, word):
        context = self.db.execute('SELECT total,types FROM contexts2 WHERE a=?', (previous,)).fetchone()
        if not context:
            return self.unigram(word)
        row = self.db.execute('SELECT n FROM continuation2 WHERE a=? AND b=?', (previous, word)).fetchone()
        count = row[0] if row else 0
        total, types = context
        return max(count - self.discount, 0) / total + self.discount * types / total * self.unigram(word)

    @functools.lru_cache(maxsize=32768)
    def probability(self, left, previous, word):
        context = self.db.execute('SELECT total,types FROM contexts3 WHERE a=? AND b=?', (left, previous)).fetchone()
        if not context:
            return self.bigram(previous, word)
        row = self.db.execute('SELECT n FROM trigrams WHERE a=? AND b=? AND c=?', (left, previous, word)).fetchone()
        count = row[0] if row else 0
        total, types = context
        return max(count - self.discount, 0) / total + self.discount * types / total * self.bigram(previous, word)

    def perplexity(self, sentences):
        log_likelihood, count, zero = 0.0, 0, 0
        for words in sentences:
            sequence = ['<s>', '<s>', *map(self.mapped, words), '</s>']
            for at in range(2, len(sequence)):
                value = self.probability(*sequence[at - 2:at + 1])
                count += 1
                if value <= 0:
                    zero += 1
                else:
                    log_likelihood += math.log(value)
        # Infinite perplexity is reported explicitly rather than hidden behind a probability floor.
        return {'examples': count, 'perplexity': math.exp(-log_likelihood / count) if count and not zero else None,
                'infinitePerplexity': bool(zero), 'zeroProbabilityTokens': zero,
                'scope': 'Mapped vocabulary/suffix classes including EOS, not unrestricted surface-word perplexity.'}

    def close(self):
        self.unigram.cache_clear()
        self.bigram.cache_clear()
        self.probability.cache_clear()
        self.db.close()


def fit(data, output, metadata):
    config = metadata['hyperparameters']
    with sqlite3.connect(Path(data / 'lexicon.sqlite').as_uri() + '?mode=ro', uri=True) as lexicon:
        vocabulary = {word for (word,) in lexicon.execute('SELECT word FROM words WHERE n >= ?',
                                                         (config['minLMFrequency'],))}
    output.mkdir(parents=True)
    started = time.perf_counter()
    report = {'status': 'running', 'stage': 'wordlm', 'profile': metadata['profile'], 'split': 'train',
              'sentences': {s: metadata['splits'][s]['sentences'] for s in ('train', 'validation')},
              'seed': config['seed'], 'hyperparameters': config, 'manifestSHA256': metadata['manifestSHA256'],
              'preparedSHA256': sha256(data / 'prepared.json'), 'device': 'cpu', 'trainingStarted': True,
              'architecture': 'Interpolated Kneser-Ney 3-gram; fixed discount; suffix-class OOV mapping',
              'testRead': False, 'calibrationPerformed': False, 'browserPromotion': 'none',
              'realUserQuality': 'not measured', 'correctionBenefit': 'not measured',
              'limitations': metadata['limitations'] + ['Suffix classes are heuristic, not linguistic morphology annotations.',
                                                       'Unseen output classes can have zero probability; infinite perplexity is explicit.',
                                                       'No noisy-channel lambda is fitted here; use separate real calibration data.']}
    write_json(output / 'report.json', report)
    def task_words(split):
        sources = set(metadata['splits'][split]['sources'])
        count = 0
        for row in jsonl(data / f'wordlm-{split}.jsonl.gz'):
            if row.get('sourceId') not in sources:
                raise ValueError('WordLM row source crosses split boundary')
            count += 1
            yield row['words']
        if count != metadata['splits'][split]['wordlmRows']:
            raise ValueError('WordLM row count differs from prepared manifest')
    try:
        sentence_count, token_count = build(output / 'wordlm.sqlite',
                                           task_words('train'),
                                           vocabulary, config['discount'])
        lm = WordLM(output / 'wordlm.sqlite')
        try:
            measured = lm.perplexity(task_words('validation'))
        finally:
            lm.close()
        report.update(status='completed', trainSentences=sentence_count, trainTokens=token_count,
                      validation=measured, artifact='wordlm.sqlite', artifactSHA256=sha256(output / 'wordlm.sqlite'),
                      elapsedSeconds=time.perf_counter() - started)
        report['estimatedFullFitSeconds'] = report['elapsedSeconds'] * (3287357 / sentence_count)
        report['estimateNote'] = 'Linear extrapolation; SQLite/vocabulary growth can make full training slower.'
        write_json(output / 'report.json', report)
        write_json(output / 'model-card.json', model_card(report))
        return report
    except BaseException as error:
        report.update(status='failed', error=str(error), elapsedSeconds=time.perf_counter() - started)
        write_json(output / 'report.json', report)
        raise
