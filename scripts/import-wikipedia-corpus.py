"""Bounded, attributed public Wikipedia import. No gated datasets or model APIs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request


def fetch(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'SlothAI-source-import/1.0'})
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def clean_article(row):
    paragraphs = []
    for raw in row.get('text', '').split('\n'):
        text = ' '.join(raw.split())
        words = re.findall(r'[^\W\d_]+', text, re.UNICODE)
        letters = ''.join(words)
        if not (90 <= len(text) <= 1600 and len(words) >= 15 and re.search(r'[.!?]["”»)]?$', text)):
            continue
        if len(set(word.lower() for word in words)) / len(words) < 0.35:
            continue
        if not letters or len(re.findall(r'[A-Za-zƏəÇçĞğIıİiÖöŞşÜü]', letters)) / len(letters) < 0.97:
            continue
        if len(re.findall(r'[əıçğöşüƏÇĞÖŞÜ]', text)) < 2 or re.search(r'https?://|<[^>]*>|\[\d+\]', text):
            continue
        paragraphs.append(text)
        if len(paragraphs) == 2:
            break
    if not paragraphs or not row.get('id') or not row.get('url'):
        return None
    return {'documentId': 'wiki-az-' + str(row['id']), 'text': '\n\n'.join(paragraphs),
            'source': row['url'], 'license': 'CC BY-SA 3.0 / GFDL',
            'protectedTerms': ['API', 'REST', 'gRPC', 'backend', 'frontend', 'GitHub', 'Linux', 'SQL', 'JSON', 'JavaScript', 'Python']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='data/nlp/wikipedia-documents.jsonl')
    parser.add_argument('--documents', type=int, default=300)
    parser.add_argument('--pages', type=int, default=24)
    parser.add_argument('--start-page', type=int, default=0)
    args = parser.parse_args()
    if not 30 <= args.documents <= 1000 or not 1 <= args.pages <= 60 or not 0 <= args.start_page <= 100:
        raise ValueError('Use 30..1000 documents and 1..60 bounded pages')
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata = fetch('https://huggingface.co/api/datasets/wikimedia/wikipedia')
    rows, seen, receipts = [], set(), []
    for page in range(args.pages):
        offset = (page + args.start_page) * 1700
        query = urllib.parse.urlencode({'dataset': 'wikimedia/wikipedia', 'config': '20231101.az', 'split': 'train', 'offset': offset, 'length': 50})
        batch = fetch('https://datasets-server.huggingface.co/rows?' + query)
        receipts.append({'offset': offset, 'rows': len(batch.get('rows', [])), 'responseSHA256': hashlib.sha256(json.dumps(batch, ensure_ascii=False, sort_keys=True).encode()).hexdigest()})
        for item in batch.get('rows', []):
            doc = clean_article(item['row'])
            if doc is None or doc['documentId'] in seen:
                continue
            seen.add(doc['documentId'])
            rows.append(doc)
            if len(rows) >= args.documents:
                break
        print(json.dumps({'page': page, 'documents': len(rows)}), flush=True)
        if len(rows) >= args.documents:
            break
    if len(rows) < 30:
        raise ValueError('Not enough clean-looking documents; no dataset published')
    contents = ''.join(json.dumps(row, ensure_ascii=False) + '\n' for row in rows)
    output.write_text(contents, encoding='utf-8')
    receipt = {'dataset': 'wikimedia/wikipedia', 'config': '20231101.az', 'upstreamRevisionAtImport': metadata.get('sha'),
               'upstreamDeclaredLicenses': metadata.get('cardData', {}).get('license'), 'documents': len(rows), 'startPage': args.start_page,
               'sourceSHA256': hashlib.sha256(contents.encode()).hexdigest(), 'requests': receipts,
               'attribution': 'Azerbaijani Wikipedia contributors; per-document article URLs link to history/authors.',
               'licenseURL': 'https://creativecommons.org/licenses/by-sa/3.0/',
               'modifications': 'Two automatically filtered paragraphs per article, whitespace normalized; synthetic noise generated separately.',
               'limitations': 'Not human-reviewed errors. The public rows API cannot pin a revision; response/source hashes detect changed upstream content. The committed excerpts are the reproducible local snapshot.'}
    output.with_suffix('.receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'documents': len(rows), 'bytes': len(contents.encode())}), flush=True)


if __name__ == '__main__':
    main()
