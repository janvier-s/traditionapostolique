#!/usr/bin/env python3
"""
Extract every patristic quote from "The Fathers Know Best" (Jimmy Akin,
Catholic Answers 2011) into a single editable CSV.

The EPUB structure makes this tractable:

  · One topic per HTML file, titled in an <h3> (e.g. "57. Purgatory")
  · Source headers as <p class="calibre15"> with a <small class="calibre7">
    containing the author or work name. ITALICISED headers are works
    ("ACTS OF PAUL AND THECLA"); non-italic are authors ("ST. ABERCIUS
    OF HIERAPOLIS").
  · Each header is followed by one <p class="calibre9"> quote paragraph
    ending with a citation in square brackets:
        [Work title, ref (c. A.D. 190)]

The extractor:
  1. Walks every HTML file in the unpacked EPUB.
  2. For each topic chapter, captures (topic, source_kind, source,
     work, reference, date, en) for every quote.
  3. Fingerprints each quote's English text and looks it up in the
     existing quotes.json so we know which are NEW.
  4. Tries to resolve the source name against authors.json so the
     user sees the existing author id (if any) and doesn't create
     duplicates when adding French translations.

Output:
  · quotes-from-epub.csv   · single flat CSV, every column the user
                              needs to add a French translation and
                              merge back into the corpus.

Run:
  python3 scripts/extract-epub-quotes.py
"""
import json
import re
import sys
import csv
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

EPUB_DIR = Path('/tmp/fkb')  # already unpacked
AUTHORS_PATH = Path('src/lib/data/authors.json')
QUOTES_PATH = Path('src/lib/data/quotes.json')
OUT_CSV = Path('quotes-from-epub.csv')


def norm_text(s):
    """Aggressive normalisation for fuzzy English-text fingerprinting."""
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'[^a-z0-9 ]', '', s)
    return s.strip()


def fingerprint(s):
    """First 80 chars of the normalised text · enough for dedupe."""
    return norm_text(s)[:80]


def quote_in_blob(quote, blob):
    """Substring match · look for any reasonable window of `quote` inside
    `blob` (both already normalised). Robust to citation-tail differences,
    leading-paragraph numbers, smart-quote vs straight-quote, etc.

    The fingerprint-style start-of-text match missed roughly 300 quotes
    where the EPUB ran the quote text together with a paragraph-number
    prefix (e.g. "7."), or where curation stripped the trailing
    "[Work, ref]" citation. A multi-window probe across the body of the
    quote catches those.
    """
    if not quote or not blob:
        return False
    if len(quote) < 30:
        return quote in blob
    # Probe windows along the quote · works even if the first 60 chars
    # or the last 60 chars differ from the EPUB version.
    step = max(30, len(quote) // 6)
    for start in range(0, len(quote) - 50, step):
        window = quote[start : start + 50]
        if window in blob:
            return True
    return False


def norm_name(s):
    """Same author-name normalisation the import script uses."""
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[‘’ʼʻ`']", "'", s)
    s = re.sub(r'^(pape\s+)?(st\.?|saint|sainte|ste\.?)\s+', '', s, flags=re.I)
    s = re.sub(r'^pape\s+', '', s, flags=re.I)
    s = re.sub(r'^pope\s+', '', s, flags=re.I)
    s = re.sub(r"[^a-z0-9']+", ' ', s).strip()
    return s


class TopicHTML(HTMLParser):
    """Parse one topic-chapter HTML file into a list of quote records.

    State machine:
      · waiting           · default
      · in_h3             · collecting chapter title text
      · in_source         · collecting a source header (calibre15)
      · in_source_italic  · the source header was wrapped in <span class=italic>
                            (i.e. it names a work, not an author)
      · in_quote          · collecting a quote paragraph (calibre9)
      · in_quote_italic   · inside an italic span inside the quote
                            (typically the work title in the citation tail)
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.topic = None
        self.in_h3 = False
        self.h3_buf = []
        # Source-header collection
        self.in_source = False
        self.source_buf = []
        self.source_italic_depth = 0
        self.source_was_italic = False
        # Quote paragraph collection
        self.in_quote = False
        self.quote_buf = []
        # Pairing state
        self.current_source = None
        self.current_source_kind = None  # 'author' or 'work'
        self.records = []

    def _has_class(self, attrs, *names):
        for k, v in attrs:
            if k == 'class' and v:
                cls = set(v.split())
                if cls & set(names):
                    return True
        return False

    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self.in_h3 = True
            self.h3_buf = []
            return
        if tag == 'p':
            if self._has_class(attrs, 'calibre15'):
                # Source header begins
                self.in_source = True
                self.source_buf = []
                self.source_italic_depth = 0
                self.source_was_italic = False
                return
            if self._has_class(attrs, 'calibre9'):
                # Quote paragraph
                self.in_quote = True
                self.quote_buf = []
                return
        if tag == 'span':
            if self.in_source and self._has_class(attrs, 'italic'):
                self.source_italic_depth += 1
                self.source_was_italic = True
            if self.in_quote and self._has_class(attrs, 'italic'):
                # mark italic regions in the quote text so we can later
                # peel off the [Work title, ref] tail accurately
                self.quote_buf.append('\x01')  # italic-on sentinel
        # ignore other tags but their text still flows through handle_data

    def handle_endtag(self, tag):
        if tag == 'h3' and self.in_h3:
            self.topic = ''.join(self.h3_buf).strip()
            # strip leading "57." numbering
            self.topic = re.sub(r'^\s*\d+\.\s*', '', self.topic)
            self.in_h3 = False
            return
        if tag == 'p':
            if self.in_source:
                self.current_source = ''.join(self.source_buf).strip()
                self.current_source_kind = 'work' if self.source_was_italic else 'author'
                self.in_source = False
                return
            if self.in_quote:
                raw = ''.join(self.quote_buf).strip()
                if self.current_source and raw:
                    self.records.append({
                        'topic': self.topic or '',
                        'source_kind': self.current_source_kind,
                        'source': self.current_source,
                        'raw': raw,
                    })
                self.in_quote = False
                return
        if tag == 'span':
            if self.in_source and self.source_italic_depth > 0:
                self.source_italic_depth -= 1
            if self.in_quote:
                self.quote_buf.append('\x02')  # italic-off sentinel

    def handle_data(self, data):
        if self.in_h3:
            self.h3_buf.append(data)
        elif self.in_source:
            self.source_buf.append(data)
        elif self.in_quote:
            self.quote_buf.append(data)


def parse_citation_tail(raw_with_marks):
    """Split a quote's raw text into (en, work, reference, date).

    The citation lives at the end inside the OUTERMOST [...] brackets. The
    italic span (between \x01 and \x02 markers) inside those brackets is
    usually the work title.
    """
    # Strip the italic markers, then locate the trailing bracketed citation
    # by counting brackets from the end.
    clean = raw_with_marks.replace('\x01', '').replace('\x02', '')
    # Find last `[` whose matching `]` is at/near the end
    last_close = clean.rfind(']')
    if last_close == -1 or last_close < len(clean) - 5:  # citation should be at the very end
        return clean.strip(), '', '', ''
    # Walk back from last_close finding the matching `[`
    depth = 0
    open_at = -1
    for i in range(last_close, -1, -1):
        if clean[i] == ']':
            depth += 1
        elif clean[i] == '[':
            depth -= 1
            if depth == 0:
                open_at = i
                break
    if open_at == -1:
        return clean.strip(), '', '', ''
    en = clean[:open_at].strip()
    tail = clean[open_at + 1:last_close].strip()
    # Drop a trailing period after the bracket, if any
    # Parse: <work>, <reference> (<date>)
    # The date is whatever sits inside the final parentheses; the work is
    # usually italicised in the EPUB (we can detect via the marker context)
    date = ''
    m = re.search(r'\(([^)]*?)\)\s*$', tail)
    if m:
        date = m.group(1).strip()
        tail = tail[:m.start()].rstrip(' ,')
    # Now the italic-span inside the original raw lives inside the
    # bracketed range · find it via markers in the original
    italic_pieces = []
    # Re-walk raw_with_marks within the bracket range to find italic spans
    raw_no_marks = ''
    italic = False
    italic_start = None
    italic_pieces = []
    for i, ch in enumerate(raw_with_marks):
        if ch == '\x01':
            italic = True
            italic_start = len(raw_no_marks)
            continue
        if ch == '\x02':
            italic = False
            italic_pieces.append((italic_start, len(raw_no_marks)))
            continue
        raw_no_marks += ch
    # find italic pieces inside the bracket range
    work = ''
    ref = tail
    for s, e in italic_pieces:
        if open_at < s and e <= last_close:
            piece = raw_no_marks[s:e].strip()
            if piece and piece.lower() not in ('a.d.', 'b.c.'):
                work = piece
                # remove the work string from `tail` to leave the reference
                ref = tail.replace(piece, '', 1).strip(' ,')
                break
    return en, work, ref, date


def main():
    authors = json.loads(AUTHORS_PATH.read_text())
    quotes = json.loads(QUOTES_PATH.read_text())

    # Build author resolver from canonical names + originalName + a few aliases.
    author_by_key = {}
    for a in authors:
        for n in [a['name'], a.get('originalName') or '']:
            k = norm_name(n)
            if k:
                author_by_key.setdefault(k, a)

    # Existing quotes · normalise each data quote's English text once
    # so the per-EPUB-quote substring probe is cheap. We also keep a
    # fingerprint map for fast first-pass lookup.
    existing_fp = {}
    existing_norms = []  # list of (id, normalised_en) for substring search
    for q in quotes:
        en = q.get('en')
        if en:
            n = norm_text(en)
            existing_fp[n[:80]] = q['id']
            existing_norms.append((q['id'], n))

    all_records = []
    for html_path in sorted(EPUB_DIR.glob('*.html')):
        text = html_path.read_text()
        p = TopicHTML()
        try:
            p.feed(text)
        except Exception as e:
            print(f'! parse error in {html_path.name}: {e}', file=sys.stderr)
            continue
        # Only keep records from doctrinal topic chapters. The book has
        # four "Know Your X" reference appendices (Fathers, Councils,
        # Heresies, Writings) whose paragraphs are descriptive entries,
        # not patristic quotes · they'd otherwise pollute the CSV.
        if not p.topic:
            continue
        tlow = p.topic.lower()
        if (
            tlow.startswith('know your')
            or 'introduction' in tlow
            or tlow.startswith('appendix')
            or tlow.startswith('preface')
        ):
            continue
        for r in p.records:
            en, work, ref, date = parse_citation_tail(r['raw'])
            if not en:
                continue
            en_norm = norm_text(en)
            # 1. Fast first-pass fingerprint lookup
            existing_id = existing_fp.get(en_norm[:80], '')
            # 2. Slow second-pass · substring probe in either direction.
            # An EPUB quote is "existing" when any data quote's normalised
            # text contains a window of this EPUB quote, OR this EPUB
            # quote contains a window of a data quote (curation may have
            # shortened or extended the text).
            if not existing_id:
                for did, dn in existing_norms:
                    if quote_in_blob(en_norm, dn) or quote_in_blob(dn, en_norm):
                        existing_id = did
                        break
            source = r['source']
            source_kind = r['source_kind']
            # try to resolve author when the header IS an author
            author_match = ''
            if source_kind == 'author':
                m = author_by_key.get(norm_name(source))
                if m:
                    author_match = f"{m['id']} · {m['name']}"
            all_records.append({
                'existing': 'Y' if existing_id else '',
                'existing_id': existing_id,
                'topic_en': r['topic'],
                'source_kind': source_kind,
                'source': source,
                'author_match': author_match,
                'work': work,
                'reference': ref,
                'date': date,
                'en': en,
                'fr': '',
                'latin': '',
                'greek': '',
                'migne': '',
                'notes': '',
            })

    # Sort: NEW (existing=='') first, then by topic
    all_records.sort(key=lambda r: (r['existing'] == 'Y', r['topic_en'], r['source']))

    headers = [
        'existing', 'existing_id',
        'topic_en', 'source_kind', 'source', 'author_match',
        'work', 'reference', 'date',
        'en', 'fr', 'latin', 'greek', 'migne', 'notes',
    ]
    # `utf-8-sig` prepends a BOM · Excel needs it to auto-detect UTF-8.
    # Without the BOM, Excel falls back to Windows-1252 and mangles
    # every accented character. Other tools (Numbers, Google Sheets,
    # text editors) ignore the BOM cleanly.
    with OUT_CSV.open('w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in all_records:
            w.writerow(r)
    new_n = sum(1 for r in all_records if not r['existing'])
    print(f'wrote {OUT_CSV} · {len(all_records)} quotes total, {new_n} new')


if __name__ == '__main__':
    main()
