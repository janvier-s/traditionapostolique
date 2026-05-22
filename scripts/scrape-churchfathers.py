#!/usr/bin/env python3
"""
Scrape every topic page from churchfathers.org, extract its quotes,
and compare against the EPUB inventory. Emit a CSV of quotes that
exist on the website but NOT in the EPUB. Same column layout as the
EPUB / XLSX-tail CSVs so the three files can be edited side-by-side.

Source structure (Squarespace site):
  · <h1>Topic Title</h1>
  · <h2>SOURCE NAME</h2>            · oxblood marginal header
  · <p class="" style="white-space:pre-wrap;">Quote text (<em>Work</em> ref [date]).</p>
  · subsequent quotes from the same source as additional <p> blocks
  · next <h2> · next source

Sources can be either an author ("ST. ABERCIUS OF HIERAPOLIS") or a
work ("THE PROTO-EVANGELIUM OF JAMES"). Squarespace does not style them
differently, so we treat them all as "source" and let the user
categorise during editing.

Cached pages are read from /tmp/cf-pages (already downloaded).
"""
import csv
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

CACHE_DIR = Path('/tmp/cf-pages')
EPUB_DIR = Path('/tmp/fkb')
AUTHORS_PATH = Path('src/lib/data/authors.json')
QUOTES_PATH = Path('src/lib/data/quotes.json')
EPUB_CSV = Path('quotes-from-epub.csv')
OUT_CSV = Path('quotes-from-churchfathers.csv')


def norm_text(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'[^a-z0-9 ]', '', s)
    return s.strip()


def norm_name(s):
    s = unicodedata.normalize('NFD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[‘’ʼʻ`']", "'", s)
    s = re.sub(r'^(pape\s+)?(st\.?|saint|sainte|ste\.?)\s+', '', s, flags=re.I)
    s = re.sub(r'^pape\s+', '', s, flags=re.I)
    s = re.sub(r"[^a-z0-9']+", ' ', s).strip()
    return s


def quote_in_blob(quote, blob):
    """Substring match · same multi-window probe as the EPUB extractor."""
    if not quote or not blob or len(quote) < 30:
        return quote in blob if quote else False
    step = max(30, len(quote) // 6)
    for start in range(0, len(quote) - 50, step):
        if quote[start:start + 50] in blob:
            return True
    return False


class TopicHTML(HTMLParser):
    """Parse one churchfathers.org topic page.

    Tracks current <h1> (topic title), <h2> (source name), and collects
    each <p class="" ...> after the most recent <h2> as a quote.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_h1 = False
        self.in_h2 = False
        self.in_p = False
        self.in_em = 0  # depth, for italic spans inside <p>
        self.title = ''
        self.h1_buf = []
        self.h2_buf = []
        self.p_buf = []
        self.current_source = None
        self.records = []  # list of {topic, source, raw, italic_spans}

    def _has_class(self, attrs, *names):
        for k, v in attrs:
            if k == 'class' and v:
                if set(v.split()) & set(names):
                    return True
        return False

    def handle_starttag(self, tag, attrs):
        if tag == 'h1':
            self.in_h1 = True
            self.h1_buf = []
        elif tag == 'h2':
            self.in_h2 = True
            self.h2_buf = []
        elif tag == 'p':
            # Quote paragraphs are the simple text blocks · skip footers/
            # nav/etc. by requiring an empty class attribute style. The
            # Squarespace blocks the editor uses always emit
            # `class="" style="white-space:pre-wrap;"`. Match liberally
            # · check both class="" and the inline style attribute.
            cls = ''
            style = ''
            for k, v in attrs:
                if k == 'class':
                    cls = v or ''
                if k == 'style':
                    style = v or ''
            if (cls == '' or cls.strip() == '') and 'pre-wrap' in style:
                self.in_p = True
                self.p_buf = []
        elif tag == 'em' or tag == 'i':
            if self.in_p:
                self.p_buf.append('\x01')  # italic on
                self.in_em += 1
        elif tag == 'br':
            if self.in_h2:
                self.h2_buf.append(' ')
            elif self.in_p:
                self.p_buf.append(' ')

    def handle_endtag(self, tag):
        if tag == 'h1' and self.in_h1:
            self.title = re.sub(r'\s+', ' ', ''.join(self.h1_buf)).strip()
            self.in_h1 = False
        elif tag == 'h2' and self.in_h2:
            self.current_source = re.sub(r'\s+', ' ', ''.join(self.h2_buf)).strip()
            self.in_h2 = False
        elif tag == 'p' and self.in_p:
            raw = ''.join(self.p_buf).strip()
            if raw and self.current_source:
                self.records.append({
                    'topic': self.title,
                    'source': self.current_source,
                    'raw': raw,
                })
            self.in_p = False
        elif (tag == 'em' or tag == 'i') and self.in_em > 0:
            self.in_em -= 1
            if self.in_p:
                self.p_buf.append('\x02')  # italic off

    def handle_data(self, data):
        if self.in_h1:
            self.h1_buf.append(data)
        elif self.in_h2:
            self.h2_buf.append(data)
        elif self.in_p:
            self.p_buf.append(data)


def parse_citation_tail(raw_with_marks):
    """Citation lives in the trailing (...) parentheses with the work
    title in italics. Strip it from `en`."""
    clean = raw_with_marks.replace('\x01', '').replace('\x02', '')
    # Find last `(` that has a matching `)` near the end
    last_close = clean.rfind(')')
    if last_close == -1:
        return clean.strip(), '', '', ''
    # Citation may include trailing `.`; allow up to ~3 trailing chars
    if last_close < len(clean) - 5:
        return clean.strip(), '', '', ''
    depth = 0
    open_at = -1
    for i in range(last_close, -1, -1):
        if clean[i] == ')':
            depth += 1
        elif clean[i] == '(':
            depth -= 1
            if depth == 0:
                open_at = i
                break
    if open_at == -1:
        return clean.strip(), '', '', ''
    en = clean[:open_at].rstrip(' ').rstrip('.').strip()
    tail = clean[open_at + 1:last_close].strip()

    # Date · grab a `[...]` trailing bracket if any
    date = ''
    m = re.search(r'\[([^\]]+?)\]\s*$', tail)
    if m:
        date = m.group(1).strip()
        tail = tail[:m.start()].rstrip(' ,')

    # Work · italic span inside the citation. Re-walk markers in raw.
    raw_no_marks = ''
    italic_pieces = []
    italic_start = None
    for ch in raw_with_marks:
        if ch == '\x01':
            italic_start = len(raw_no_marks)
            continue
        if ch == '\x02':
            italic_pieces.append((italic_start, len(raw_no_marks)))
            continue
        raw_no_marks += ch

    work = ''
    ref = tail
    for s, e in italic_pieces:
        if open_at < s and e <= last_close:
            piece = raw_no_marks[s:e].strip()
            if piece:
                work = piece
                ref = tail.replace(piece, '', 1).strip(' ,')
                break
    return en, work, ref, date


# ---------------------------------------------------------------------------
# Migne volume lookup · curated table for confident cases only.
#
# Migne reference = "PG <vol>, col. <col>" (Patrologia Graeca) or
# "PL <vol>, col. <col>" (Latina). Column numbers are page-specific and
# can't be generated programmatically · we suggest the canonical VOLUME
# only and leave the column for the user.
#
# Map keys are (author_norm, work_norm_token). The work_norm_token is a
# distinguishing substring of the EN work title as it appears on
# churchfathers.org so the same author's different works map to
# different volumes.
# ---------------------------------------------------------------------------
MIGNE_BY_AUTHOR_WORK = {
    # Augustine (PL 32-47)
    ('augustine', 'city of god'): 'PL 41',
    ('augustine', 'civitate'): 'PL 41',
    ('augustine', 'trinity'): 'PL 42',
    ('augustine', 'trinitate'): 'PL 42',
    ('augustine', 'tractate'): 'PL 35',
    ('augustine', 'tractates'): 'PL 35',
    ('augustine', 'homilies on john'): 'PL 35',
    ('augustine', 'letters'): 'PL 33',
    ('augustine', 'epistles'): 'PL 33',
    ('augustine', 'confessions'): 'PL 32',
    ('augustine', 'sermon'): 'PL 38',
    ('augustine', 'sermons'): 'PL 38',
    ('augustine', 'enchiridion'): 'PL 40',
    ('augustine', 'doctrina'): 'PL 34',
    ('augustine', 'doctrine'): 'PL 34',
    ('augustine', 'genesis'): 'PL 34',
    ('augustine', 'baptism'): 'PL 43',
    ('augustine', 'catechizandis'): 'PL 40',
    ('augustine', 'donatist'): 'PL 43',
    ('augustine', 'expositions on the psalms'): 'PL 36',
    ('augustine', 'expositions of the psalms'): 'PL 36',
    ('augustine', 'natura'): 'PL 44',
    # John Chrysostom (PG 47-64)
    ('john chrysostom', 'homilies on matthew'): 'PG 57',
    ('chrysostom', 'homilies on matthew'): 'PG 57',
    ('chrysostom', 'homilies on john'): 'PG 59',
    ('chrysostom', 'homilies on romans'): 'PG 60',
    ('chrysostom', 'homilies on first corinthians'): 'PG 61',
    ('chrysostom', 'homilies on 1 corinthians'): 'PG 61',
    ('chrysostom', 'homilies on the epistle to the hebrews'): 'PG 63',
    ('chrysostom', 'priesthood'): 'PG 48',
    ('chrysostom', 'on the priesthood'): 'PG 48',
    ('chrysostom', 'baptismal'): 'PG 49',
    ('chrysostom', 'letters'): 'PG 52',
    # Cyprian (PL 3-4)
    ('cyprian of carthage', 'letters'): 'PL 4',
    ('cyprian', 'letters'): 'PL 4',
    ('cyprian', 'unity of the catholic church'): 'PL 4',
    ('cyprian', 'lapsed'): 'PL 4',
    # Epiphanius (PG 41-43)
    ('epiphanius of salamis', 'panarion'): 'PG 41',
    ('epiphanius', 'panarion'): 'PG 41',
    ('epiphanius', 'medicine chest'): 'PG 41',
    ('epiphanius', 'against heresies'): 'PG 41',
    ('epiphanius', 'ancoratus'): 'PG 43',
    # Cyril of Jerusalem (PG 33)
    ('cyril of jerusalem', 'catechetical lectures'): 'PG 33',
    ('cyril of jerusalem', 'catechetical'): 'PG 33',
    # Ignatius of Antioch (PG 5)
    ('ignatius of antioch', 'letter'): 'PG 5',
    ('ignatius of antioch', 'epistle'): 'PG 5',
    # Irenaeus (PG 7)
    ('irenaeus', 'against heresies'): 'PG 7',
    ('irenaeus of lyons', 'against heresies'): 'PG 7',
    # Origen (PG 11-17)
    ('origen', 'against celsus'): 'PG 11',
    ('origen', 'on first principles'): 'PG 11',
    ('origen', 'principiis'): 'PG 11',
    ('origen', 'commentary on john'): 'PG 14',
    ('origen', 'commentary on matthew'): 'PG 13',
    ('origen', 'homilies on luke'): 'PG 13',
    # Jerome (PL 22-30)
    ('jerome', 'letters'): 'PL 22',
    ('jerome', 'epistles'): 'PL 22',
    ('jerome', 'against jovinian'): 'PL 23',
    ('jerome', 'against helvidius'): 'PL 23',
    # Tertullian (PL 1-2)
    ('tertullian', 'apology'): 'PL 1',
    ('tertullian', 'baptism'): 'PL 1',
    ('tertullian', 'prescription'): 'PL 2',
    ('tertullian', 'against marcion'): 'PL 2',
    ('tertullian', 'flesh of christ'): 'PL 2',
    ('tertullian', 'veiling of virgins'): 'PL 2',
    # Pope Leo I (PL 54-56)
    ('pope leo i', 'letters'): 'PL 54',
    ('pope leo i', 'sermons'): 'PL 54',
    ('leo i', 'letters'): 'PL 54',
    ('leo the great', 'letters'): 'PL 54',
    # Eusebius (PG 19-24)
    ('eusebius of caesarea', 'ecclesiastical history'): 'PG 20',
    ('eusebius', 'ecclesiastical history'): 'PG 20',
    ('eusebius', 'history of the church'): 'PG 20',
    # Hippolytus (PG 10)
    ('hippolytus', 'refutation of all heresies'): 'PG 10',
    ('hippolytus', 'apostolic tradition'): 'PG 10',
    # Gregory of Nazianzus (PG 35-38)
    ('gregory of nazianzus', 'oration'): 'PG 35',
    ('gregory of nazianzus', 'orations'): 'PG 35',
    # Dionysius of Corinth (cited via Eusebius PG 20)
    ('dionysius of corinth', ''): 'PG 20',
    # The Martyrs of Lyons (in Eusebius PG 20)
    ('the martyrs of lyons', ''): 'PG 20',
}


def suggest_migne(source, work):
    """Look up a likely Migne volume by (author, work). Returns
    'PL 41' / 'PG 20' / '' string · column number is left for the user."""
    src_key = source.lower().strip()
    # strip the "ST. " / "POPE " etc. honorifics for matching
    src_key = re.sub(r'^(st\.?|saint|pope|pope\s+st\.?)\s+', '', src_key, flags=re.I)
    work_key = (work or '').lower().strip()
    # exact key first
    if (src_key, work_key) in MIGNE_BY_AUTHOR_WORK:
        return MIGNE_BY_AUTHOR_WORK[(src_key, work_key)]
    # substring on the work
    for (a_key, w_key), vol in MIGNE_BY_AUTHOR_WORK.items():
        if a_key != src_key:
            continue
        if not w_key:
            continue
        if w_key in work_key:
            return vol
    # author-only key (for sources that name a work directly, e.g.
    # "DIONYSIUS OF CORINTH" with no separate work title)
    if (src_key, '') in MIGNE_BY_AUTHOR_WORK:
        return MIGNE_BY_AUTHOR_WORK[(src_key, '')]
    return ''


def main():
    authors = json.loads(AUTHORS_PATH.read_text())
    data_quotes = json.loads(QUOTES_PATH.read_text())

    author_by_key = {}
    for a in authors:
        for n in [a['name'], a.get('originalName') or '']:
            k = norm_name(n)
            if k:
                author_by_key.setdefault(k, a)

    # Concatenate every EPUB HTML file into one normalised blob so we
    # can substring-search for every churchfathers quote in one pass.
    epub_blob_parts = []
    for p in sorted(EPUB_DIR.glob('*.html')):
        h = p.read_text()
        h = re.sub(r'<[^>]+>', ' ', h)
        epub_blob_parts.append(h)
    import html as htmlmod
    epub_blob = htmlmod.unescape(' '.join(epub_blob_parts))
    epub_norm = norm_text(epub_blob)

    # Existing data blob for the "in current data" flag.
    data_norm = norm_text(' '.join(q.get('en') or '' for q in data_quotes))

    # Scrape every cached topic page.
    all_records = []
    for html_path in sorted(CACHE_DIR.glob('*.html')):
        h = html_path.read_text()
        p = TopicHTML()
        try:
            p.feed(h)
        except Exception as e:
            print(f'! parse error in {html_path.name}: {e}', file=sys.stderr)
            continue
        # Ibid resolution · track the last explicit work title per source
        # block. churchfathers.org uses "ibid., 55[52]:1" to mean "same
        # work as the previous quote from this source". When we see one,
        # substitute the previous quote's work title back in so the
        # citation is self-contained.
        last_work_by_source = {}
        for r in p.records:
            en, work, ref, date = parse_citation_tail(r['raw'])
            src_key = r['source'].strip().lower()
            # ibid in the reference field · adopt the previous work
            ibid_match = re.match(r'^ibid\.?,?\s*(.*)$', ref or '', re.I)
            if ibid_match:
                prev_work = last_work_by_source.get(src_key, '')
                if prev_work:
                    work = prev_work
                    ref = ibid_match.group(1).strip()
            # If we have a real work title now, remember it for future ibid
            if work:
                last_work_by_source[src_key] = work
            if not en or len(en) < 30:
                continue
            en_norm = norm_text(en)
            in_epub = quote_in_blob(en_norm, epub_norm)
            in_data = quote_in_blob(en_norm, data_norm)
            source = r['source']
            # Heuristic: source-kind is "work" if the source name reads
            # like a work title (starts with "the", "to", or matches the
            # parsed work title from the citation). Otherwise "author".
            source_kind = 'author'
            sl = source.lower()
            if (
                sl.startswith('the ')
                or sl.startswith('to ')
                or sl.startswith('acts of')
                or sl.startswith('letter')
                or sl.startswith('martyrdom')
                or sl.startswith('didache')
                or sl.startswith('apostolic constitutions')
                or sl.startswith('council ')
                or sl.startswith('protoevangelium')
                or sl.startswith('proto-evangelium')
                or sl.startswith('early christian inscription')
                or sl.startswith('apocalypse of')
                or sl.startswith('shepherd of hermas')
            ):
                source_kind = 'work'
            author_match = ''
            if source_kind == 'author':
                m = author_by_key.get(norm_name(source))
                if m:
                    author_match = f"{m['id']} · {m['name']}"
            migne_suggested = suggest_migne(source, work)
            all_records.append({
                'existing_in_epub': 'Y' if in_epub else '',
                'existing_in_data': 'Y' if in_data else '',
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
                # Suggested Migne volume only · the column number must be
                # looked up against the printed PG/PL edition. Cells where
                # the lookup table has no entry stay blank.
                'migne': migne_suggested,
                'notes': '',
            })

    # The user asked for the quotes NOT in the EPUB · filter to those.
    not_in_epub = [r for r in all_records if not r['existing_in_epub']]
    # Sort: those also missing from current data first, then by topic.
    not_in_epub.sort(key=lambda r: (r['existing_in_data'] == 'Y', r['topic_en'], r['source']))

    headers = [
        'existing_in_epub', 'existing_in_data',
        'topic_en', 'source_kind', 'source', 'author_match',
        'work', 'reference', 'date',
        'en', 'fr', 'latin', 'greek', 'migne', 'notes',
    ]
    with OUT_CSV.open('w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in not_in_epub:
            w.writerow(r)

    n_total = len(all_records)
    n_in_epub = sum(1 for r in all_records if r['existing_in_epub'])
    n_in_data = sum(1 for r in all_records if r['existing_in_data'])
    n_new = sum(1 for r in not_in_epub if not r['existing_in_data'])
    print(
        f'wrote {OUT_CSV} · {len(not_in_epub)} quotes NOT in EPUB '
        f'(of which {n_new} also not in current data) · '
        f'scraped {n_total} total · {n_in_epub} in EPUB · {n_in_data} in data'
    )


if __name__ == '__main__':
    main()
