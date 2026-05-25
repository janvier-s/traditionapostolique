#!/usr/bin/env python3
"""
Harvest quotes from Bercot's *Dictionary of Early Christian Beliefs* (Hendrickson,
2014 eBook) into docs/bercot-harvest/.

Spec: docs/superpowers/specs/2026-05-25-bercot-harvest-design.md

Run: python3 scripts/bercot-harvest.py
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path
from bs4 import BeautifulSoup

REPO = Path(__file__).resolve().parents[1]
EPUB = (
    Path.home()
    / "Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/fathers/epubs"
    / "A dictionary of early Christian beliefs _ a reference guide -- David W_ Bercot -- Tyndale House (eBook), Peabody, Mass, 2014 -- Hendrickson Academic -- 9781565633575 -- c2363a8c773dd0eb0b89ba37335c88da -- Anna’s Archive.epub"
)
OUT = REPO / "docs/bercot-harvest"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Harvest the Bercot dictionary.")
    p.add_argument("--emit-json", action="store_true",
                   help="Emit src/lib/data/bercot.json (default if no flags).")
    p.add_argument("--emit-md", action="store_true",
                   help="Emit per-topic Markdown to docs/bercot-harvest/.")
    return p.parse_args()


BERCOT_JSON_PATH = REPO / "src/lib/data/bercot.json"


def stable_id(entry: str, subsection: str | None, attribution: str, en_text: str) -> str:
    payload = f"{entry}|{subsection or ''}|{attribution}|{en_text}".encode("utf-8")
    return hashlib.sha1(payload).hexdigest()[:12]

# -----------------------------------------------------------------------------
# Topic -> TOC-entry mapping  (confidence: high | medium | low)
# -----------------------------------------------------------------------------

MAPPING: dict[str, list[tuple[str, str]]] = {
    "seul-vrai-dieu":                  [("GOD","high"), ("GOD, ATTRIBUTES OF","high"), ("ATTRIBUTES OF GOD","medium")],
    "dieu-n-a-pas-de-corps":           [("ANTHROPOMORPHISMS","high"), ("ATTRIBUTES OF GOD","medium"), ("GOD, ATTRIBUTES OF","medium")],
    "trinite":                         [("TRINITY","high")],
    "trois-personnes-de-la-trinite":   [("TRINITY","high"), ("FATHER, GOD THE","high"), ("SON OF GOD","high"), ("HOLY SPIRIT","high"), ("SPIRIT, HOLY","medium"), ("PARACLETE","medium")],
    "divinite-du-christ":              [("CHRIST, DIVINITY OF § I","high")],
    "filiation-eternelle-du-christ":   [("CHRIST, DIVINITY OF § II","high"), ("ONLY BEGOTTEN","high"), ("LOGOS","high"), ("WORD OF GOD (CHRIST)","high"), ("SON OF GOD","medium")],
    "filioque":                        [("FILIOQUE","high")],
    "creation-ex-nihilo":              [("CREATION","high")],
    "creation-dans-la-genese":         [("CREATION","high"), ("CREATIVE DAYS","high"), ("DAYS OF CREATION","medium"), ("GENESIS","high"), ("SEVENTH DAY OF CREATION","medium")],
    "canon-des-ecritures":             [("CANON, NEW TESTAMENT","high"), ("CANON, OLD TESTAMENT","high"), ("SCRIPTURES § II","medium"), ("SCRIPTURES § III","medium"), ("APOCRYPHA, NEW TESTAMENT","medium"), ("APOCRYPHA, OLD TESTAMENT","medium"), ("DEUTEROCANONICAL BOOKS","high"), ("MURATORIAN FRAGMENT","medium")],
    "tradition-apostolique":           [("TRADITION § II","high"), ("APOSTOLIC FAITH","high"), ("RULE OF FAITH","high")],
    "eglise-catholique":               [("CATHOLIC CHURCH","high"), ("CHURCH, THE","medium")],
    "succession-apostolique":          [("APOSTOLIC SUCCESSION","high"), ("CHURCHES, APOSTOLIC § I","medium")],
    "pierre-le-roc":                   [("PETER","high"), ("BINDING AND LOOSING","high"), ("KEYS OF THE KINGDOM","high")],
    "primaute-de-pierre":              [("PETER","medium")],
    "pierre-a-rome":                   [("PETER","medium"), ("ROME","medium"), ("ROME, CHURCH AT","high"), ("CHURCHES, APOSTOLIC § VI","high")],
    "successeurs-de-pierre":           [("BISHOP § II","high"), ("LINUS","high"), ("CHURCHES, APOSTOLIC § VI","medium")],
    "autorite-du-pape":                [("BISHOP § II","high"), ("VICAR OF CHRIST","high"), ("ROME, CHURCH AT","medium")],
    "peche-mortel":                    [("SIN § I","high"), ("SIN § II","high"), ("UNFORGIVABLE SIN","high")],
    "avortement":                      [("ABORTION, INFANTICIDE","high"), ("INFANTICIDE","medium"), ("ABANDONMENT OF INFANTS","medium"), ("INFANTS, ABANDONMENT OF","medium"), ("INFANTS, EXPOSURE OF","medium")],
    "contraception-et-la-sterilisation":[("BIRTH CONTROL","high"), ("PROCREATION","high")],
    "homosexualite":                   [("HOMOSEXUALITY","high"), ("SODOM","medium")],
    "astrologie":                      [("ASTROLOGY","high"), ("HOROSCOPE","high"), ("ZODIAC","medium")],
    "bapteme-comme-moyen-de-grace":    [("BAPTISM § I","high")],
    "regeneration-baptismale":         [("BAPTISM § I","high"), ("REGENERATION","high"), ("NEW BIRTH","high"), ("BORN AGAIN","high")],
    "necessite-du-bapteme":            [("BAPTISM § I","medium")],
    "bapteme-trinitaire":              [("BAPTISM § II","high"), ("REBAPTISM","medium")],
    "bapteme-des-enfants":             [("INFANT BAPTISM","high"), ("BAPTISM § III","high")],
    "confirmation":                    [("CONFIRMATION","high"), ("CHRISM","high"), ("LAYING ON OF HANDS","high"), ("HANDS, LAYING ON OF","medium")],
    "presence-reelle":                 [("REAL PRESENCE","high"), ("EUCHARIST","high"), ("COMMUNION","medium"), ("LORD’S SUPPER","medium"), ("TRANSUBSTANTIATION","high")],
    "sacrifice-de-la-messe":           [("MASS","high"), ("SACRIFICES, SPIRITUAL","high"), ("ALTAR","medium"), ("EUCHARIST","medium")],
    "confession":                      [("CONFESSION OF SINS","high"), ("EXOMOLOGESIS","high"), ("PENANCE","high"), ("ABSOLUTION","high")],
    "eveque-pretre-et-diacre":         [("BISHOP § I","high"), ("PRESBYTER","high"), ("DEACON","high"), ("CLERGY","medium"), ("OFFICERS, CHURCH","medium"), ("ORDERS, HOLY","medium"), ("ORDINATION","medium"), ("CHURCH GOVERNMENT","medium")],
    "femmes-pretres":                  [("WOMEN § V","high"), ("DEACONESS","high")],
    "permanence-du-mariage":           [("MARRIAGE","high"), ("DIVORCE","high"), ("REMARRIAGE","high"), ("TWICE-MARRIED","medium")],
    "sabbat-ou-dimanche":              [("SABBATH","high"), ("LORD’S DAY","high"), ("EIGHTH DAY","medium")],
    "marie-pleine-de-grace":           [("MARY","medium")],
    "marie-mere-de-dieu":              [("MARY","high"), ("THEOTOKOS","high")],
    "marie-toujours-vierge":           [("MARY","high"), ("VIRGIN BIRTH","medium"), ("BROTHERS OF JESUS","high"), ("JESUS, BROTHERS OF","medium")],
    "intercession-des-saints":         [("SAINTS, VENERATION OF","high"), ("PRAYER § V","high"), ("PRAYER § VII","high"), ("DEAD, PRAYERS FOR THE","high"), ("DEAD, WORSHIP OF THE","medium")],
    "miracles-continus":               [("MIRACLES","high"), ("HEALING, DIVINE","high"), ("GIFTS OF THE SPIRIT","high"), ("SPIRITUAL GIFTS","medium")],
    "revelation-privee":               [("VISIONS","medium"), ("PROPHECY, PROPHETS","medium"), ("HEARING FROM GOD","medium"), ("DREAMS","low")],
    "salut-en-dehors-de-l-eglise":     [("SALVATION § I","high"), ("HERESIES, HERETICS § I","low")],
    "recompense-et-le-merite":         [("MERIT","high"), ("WORKS","high"), ("SALVATION § III","high"), ("JUSTIFICATION BY FAITH","medium"), ("OBEDIENCE, ROLE IN SALVATION","high"), ("ETERNAL PUNISHMENTS AND REWARDS","medium")],
    "purgatoire":                      [("PURGATORY","high"), ("DEAD, INTERMEDIATE STATE OF THE","high"), ("INTERMEDIATE STATE","medium"), ("DEAD, PRAYERS FOR THE","medium"), ("PRAYER § VI","high")],
    "enfer":                           [("HELL","high"), ("GEHENNA","high"), ("LAKE OF FIRE","high"), ("PUNISHMENT, ETERNAL","high"), ("ETERNAL PUNISHMENTS AND REWARDS","medium"), ("TARTARUS","medium"), ("HADES","medium")],
    "reincarnation":                   [("REINCARNATION","high"), ("TRANSMIGRATION OF SOULS","high")],
    "resurrection-des-corps":          [("RESURRECTION OF THE DEAD","high"), ("UNCORRUPTED BODIES","medium")],
    "antechrist":                      [("ANTICHRIST","high"), ("BEAST, THE","high"), ("MARK OF THE BEAST","high"), ("SIX HUNDRED SIXTY-SIX","medium"), ("144, 000","low"), ("ONE HUNDRED AND FORTY-FOUR THOUSAND","low"), ("HUNDRED AND FORTY-FOUR THOUSAND","low")],
}

# -----------------------------------------------------------------------------
# Catholic-relevant TOC entries that are NOT consumed by the 49 site topics.
# Each gets a 1-line "why it fits" note.
# -----------------------------------------------------------------------------

CANDIDATES: dict[str, str] = {
    # Sacraments & ministers
    "ACOLYTE":            "Minor order — Catholic clerical hierarchy",
    "ANOINTING":          "Sacramental sign (chrism, anointing of the sick)",
    "CHALICE":            "Eucharistic vessel — sacred liturgical use",
    "CHRISM":             "Sacramental oil — confirmation, ordination, anointing of sick",
    "CATECHUMENS":        "Catechumenate — pre-baptismal formation",
    "DEACONESS":          "Female diaconate — recurring Catholic debate",
    "ELDERS":             "Presbyteral order, complementary to BISHOP/PRESBYTER",
    "FEETWASHING":        "Holy Thursday rite (mandatum)",
    "FOOTWASHING":        "Same — Mandatum",
    "GODPARENTS":         "Baptismal sponsors — Catholic practice",
    "MAJOR ORDERS":       "Bishop, priest, deacon — Catholic holy orders",
    "MINOR ORDERS":       "Acolyte, lector, exorcist, porter — Catholic tradition",
    "ORDINATION":         "Sacrament of holy orders",
    "ORDERS, HOLY":       "Sacrament of holy orders (cross-ref)",
    "OIL, ANOINTING WITH":"Sacramental anointing",
    "PATEN":              "Eucharistic vessel",
    "READER":             "Lector — minor order/liturgical ministry",
    "SACRAMENTS":         "Catholic sacramental theology in general",
    "SUBDEACON":          "Suppressed minor order — historical Catholic ministry",
    "VESSELS, EUCHARISTIC":"Chalice/paten/ciborium — Catholic eucharistic theology",
    "VESTMENTS, RELIGIOUS":"Liturgical garments — Catholic worship",
    "VIRGINS, ORDER OF":  "Consecrated virgins — Catholic order",
    "WIDOWS, ORDER OF":   "Order of widows — early Catholic ministry",
    "NUNS":               "Religious sisters — Catholic consecrated life",
    "MONKS":              "Monastic life — Catholic religious",
    "MONASTICISM":        "Catholic monastic tradition",
    "CELIBACY":           "Clerical and consecrated celibacy",

    # Doctrine
    "ATONEMENT":          "Christ's redemptive sacrifice — Catholic soteriology",
    "COUNCILS, CHURCH":   "Conciliar authority — Catholic ecclesiology",
    "CREEDS, EARLY":      "Apostles' Creed, regula fidei — Catholic doctrinal continuity",
    "DEIFICATION OF MAN": "Theosis — Catholic & Orthodox soteriology",
    "DESCENT INTO HADES": "Apostles' Creed article — 'descended into hell'",
    "ECONOMY OF GOD":     "Divine oikonomia — patristic & Catholic concept",
    "FAITH":              "Foundational virtue — counterpoint to JUSTIFICATION BY FAITH",
    "FORGIVENESS OF SINS":"Sacramental absolution & penance",
    "FREE WILL AND PREDESTINATION":"Catholic anti-determinist tradition",
    "GRACE":              "Catholic doctrine of grace",
    "HYPOSTATIC UNION":   "Christological dogma (Chalcedon)",
    "IDOLATRY":           "Foundation for Catholic discussion of IMAGES",
    "IMAGES":             "Iconoclasm vs Catholic veneration of images",
    "ICON":               "Holy images — Catholic & Orthodox veneration",
    "INCARNATION":        "Central Catholic Christological dogma",
    "INSPIRATION":        "Inspiration of Scripture — Catholic doctrine",
    "LAW, NATURAL":       "Natural law — Catholic moral theology",
    "NATURAL LAW":        "Same (cross-ref)",
    "MEDIATOR":           "Christ the one mediator — counterpoint to INTERCESSION",
    "ORIGINAL SIN":       "Catholic dogma of original sin",
    "PARACLETE":          "Holy Spirit as Advocate — already adjacent to topic #4",
    "PROVIDENCE OF GOD":  "Divine providence — Catholic doctrine",
    "RANSOM":             "Ransom theory of atonement",
    "RECAPITULATION":     "Irenaean recapitulation — patristic Catholic soteriology",
    "REDEMPTION":         "Catholic soteriology",
    "RELICS OF MARTYRS AND SAINTS":"Veneration of relics — distinctively Catholic",
    "VENERATION OF RELICS":"Same (cross-ref)",
    "REPENTANCE":         "Metanoia — sacramental penance",
    "RESURRECTION OF CHRIST":"Catholic Easter mystery",
    "RIGHTEOUSNESS OF GOD":"Justification — Catholic vs Reformation contrast",
    "SCHISM":             "Catholic ecclesiology — schism and unity",
    "SINLESSNESS":        "Catholic concept (relevant to Marian doctrine)",
    "SOUL":               "Catholic anthropology",
    "SOUL SLEEP":         "Catholic doctrine of intermediate state (counterpoint)",
    "SUBSTANCE":          "Eucharistic transubstantiation — substance/accidents",
    "SYNERGISM":          "Cooperation with grace — Catholic vs monergism",

    # Liturgy / practice / spirituality
    "AMEN":               "Liturgical acclamation",
    "ASCETICISM":         "Catholic ascetic spirituality",
    "ASCENSION OF CHRIST":"Liturgical solemnity",
    "BURIAL AND FUNERAL PRACTICES OF CHRISTIANS":"Catholic funerary practice",
    "CALENDAR, CHRISTIAN":"Liturgical year — Catholic calendar",
    "CANDLES":            "Liturgical use of candles",
    "CHURCH BUILDINGS":   "Sacred architecture",
    "BUILDINGS, CHURCH":  "Same (cross-ref)",
    "DISCIPLINE, CHURCH": "Canon law roots — Catholic discipline",
    "EASTER":             "Liturgical year — Catholic Easter",
    "EPIPHANY":           "Liturgical feast",
    "EXCOMMUNICATION":    "Catholic disciplinary practice",
    "EXORCISM":           "Catholic sacramental — exorcists order",
    "EXOMOLOGESIS":       "Public confession/penance — Catholic discipline",
    "FASTING":            "Penitential fasting — Catholic discipline",
    "FUNERAL PRACTICES, CHRISTIAN":"Same (cross-ref)",
    "HOLY KISS":          "Liturgical kiss of peace",
    "KISS OF PEACE":      "Liturgical pax",
    "HOLY WEEK":          "Sacred Triduum",
    "HOLIDAYS, CHRISTIAN":"Catholic feasts",
    "INCENSE":            "Liturgical use of incense",
    "KNEELING":           "Liturgical posture",
    "LAITY":              "Vocation of the laity — Catholic ecclesiology",
    "LAPSED":             "Treatment of apostates — Catholic discipline (Cyprian controversy)",
    "LAYING ON OF HANDS": "Confirmation/ordination/healing — Catholic gesture",
    "HANDS, LAYING ON OF":"Same (cross-ref)",
    "LENT":               "Lenten observance",
    "LITURGY":            "Catholic liturgical worship",
    "LORD’S PRAYER":      "Pater noster — Catholic liturgical/catechetical staple",
    "LOVE FEAST":         "Agape meal — early Catholic practice",
    "MARTYRS, MARTYRDOM": "Cult of martyrs — feeds INTERCESSION OF SAINTS",
    "MORNING AND EVENING PRAYER":"Liturgy of the Hours roots",
    "MYSTERIES, CHRISTIAN":"Sacramental 'mysteries' — Catholic & Orthodox term",
    "OATHS":              "Catholic moral theology on oaths",
    "PASCHA":             "Easter — Catholic Pasch",
    "PASCHAL CONTROVERSY":"Patristic dating dispute — Catholic discipline",
    "PASSOVER, CHRISTIAN":"Easter typology",
    "PENANCE":            "Sacrament of reconciliation",
    "PENTECOST":          "Liturgical solemnity",
    "PERFECTION, CHRISTIAN":"Catholic spiritual theology",
    "PERSECUTION":        "Martyrs and confessors — Catholic memory",
    "PRAYER":             "Catholic spiritual practice",
    "PRAYER VEIL":        "Liturgical veiling of women — disputed Catholic practice",
    "PREACHING":          "Catholic homiletics",
    "SACRIFICES, SPIRITUAL":"Spiritual sacrifice — Catholic priesthood of the faithful",
    "SIGN OF THE CROSS":  "Catholic devotional gesture",
    "SIMONY":             "Catholic canonical offense",
    "STATIONS":           "Stational liturgy / fast-day stations",
    "SURSUM CORDA":       "Eucharistic prayer dialogue",
    "SYNODS":             "Catholic synodal governance",
    "TEN COMMANDMENTS":   "Catholic moral teaching",
    "TITHES, TITHING":    "Catholic precept on supporting the Church",
    "UNION WITH GOD":     "Catholic mystical theology",
    "USURY":              "Catholic moral theology on lending",
    "VEIL":               "Veiling practices",
    "VOICE OF GOD":       "Discernment — Catholic spiritual theology",
    "WORSHIP, CHRISTIAN": "Catholic liturgical worship",

    # Christology / Mariology adjacent
    "CHRIST, TITLES OF":  "Names and titles of Christ",
    "BLOOD OF CHRIST":    "Eucharistic and atonement theology",
    "MOTHER, SPIRITUAL":  "Marian/ecclesial typology",

    # Heresies vs Catholic faith — included as foils (curate later)
    "DOCETISTS":          "Catholic Christology defined against docetism",
    "MARCION":            "Catholic canon defined against Marcion",
    "MONARCHIANISM":      "Trinitarian heresy — Catholic doctrine forged against it",
    "MONTANISTS":         "Catholic discipline defined against Montanism",
    "NOVATIAN, NOVATIANISTS":"Catholic reconciliation of lapsed defined against rigorism",
    "PATRIPASSIANISM":    "Trinitarian heresy",
    "SABELLIANISM":       "Trinitarian heresy",
    "GNOSTICS, GNOSTICISM":"Catholic doctrine defined against Gnosticism",
    "ARIUS, ARIANISM":    "Catholic Trinitarian dogma defined against Arianism",
}

# -----------------------------------------------------------------------------
# EPUB parsing
# -----------------------------------------------------------------------------

# Attribution pattern: "Author Name (qualifier), vol.page." possibly with extensions.
# Examples:
#   Tertullian (c. 197, W), 3.156.
#   Cyprian (c. 250, W), 5.454; see also 2.105.
#   Moses of Chorene (date uncertain, E), 8.702; extended discussion: 8.651–8.653.
ATTR_RE = re.compile(
    r"^\s*([A-Z][A-Za-z .'’—-]+?)\s*\(([^)]+)\)\s*,\s*"
    r"(\d+\.\d+(?:[–—\-]\d+(?:\.\d+)?)?)"
    r"(.*)$"
)


def unzip_epub(epub: Path, dest: Path) -> None:
    subprocess.run(["unzip", "-q", str(epub), "-d", str(dest)], check=True)


def html_files_in_order(epub_root: Path) -> list[Path]:
    text_dir = epub_root / "text"
    return sorted(text_dir.glob("part*.html"))


def normalize_ws(s: str) -> str:
    s = s.replace(" ", " ")
    s = re.sub(r"[\t ]+", " ", s)
    return s.strip()


def collect_entries(epub_root: Path) -> dict[str, dict]:
    """
    Walk every part*.html, find <h3 class="calibre13"> headings, and collect
    the following <p> siblings until the next <h3> or section break.

    A few large entries (e.g. BAPTISM, BISHOP, EUCHARIST) have internal Roman-
    numeral subsections marked by <h5 class="calibre14">. When present, quotes
    are bucketed per subsection so mappings can target e.g. `BISHOP § II`.

    Returns:
        {entry_title: {
            intro: str,
            quotes: [...],         # all quotes if no subsections, else []
            subsections: [{title, quotes, see_also}, ...],
            see_also: str|None,    # entry-level SEE ALSO (no subsections case)
            source_file: str,
        }}
    """
    entries: dict[str, dict] = {}
    for path in html_files_in_order(epub_root):
        with path.open() as f:
            soup = BeautifulSoup(f, "html.parser")
        for h3 in soup.find_all("h3", class_="calibre13"):
            title = normalize_ws(h3.get_text())
            if not title:
                continue
            intro_parts: list[str] = []
            quotes: list[dict] = []
            see_also: str | None = None
            subsections: list[dict] = []
            current_sub: dict | None = None

            node = h3.next_sibling
            while node is not None:
                name = getattr(node, "name", None)
                if name in ("h3", "h1"):
                    break  # next entry or letter section
                if name == "h5":
                    # Subsection header (Roman-numeral)
                    sub_title = normalize_ws(node.get_text())
                    if sub_title:
                        current_sub = {"title": sub_title, "quotes": [], "see_also": None}
                        subsections.append(current_sub)
                    node = node.next_sibling
                    continue
                if name == "p":
                    cls = " ".join(node.get("class") or [])
                    text = normalize_ws(node.get_text())
                    if not text:
                        node = node.next_sibling
                        continue
                    if "outline" in cls:
                        # The "I. ... / II. ..." outline at the top of long entries
                        # is purely a TOC for the entry — skip.
                        node = node.next_sibling
                        continue
                    if "cross-ref" in cls:
                        if text.upper().startswith("SEE"):
                            if current_sub is not None:
                                current_sub["see_also"] = text
                            else:
                                see_also = text
                        node = node.next_sibling
                        continue
                    quote_text, attribution = split_attribution(node)
                    if attribution:
                        if current_sub is not None:
                            current_sub["quotes"].append({"text": quote_text, "attribution": attribution})
                        else:
                            quotes.append({"text": quote_text, "attribution": attribution})
                    elif current_sub is None and not quotes and "nofirst" in cls:
                        intro_parts.append(text)
                    elif current_sub is None and not quotes:
                        intro_parts.append(text)
                    # else: Scripture epigraph between attributed quotes — skip
                node = node.next_sibling

            entries[title] = {
                "intro": "\n\n".join(intro_parts),
                "quotes": quotes,
                "subsections": subsections,
                "see_also": see_also,
                "source_file": path.name,
            }
    return entries


def resolve_target(spec: str, entries: dict) -> tuple[str, dict | None, str | None]:
    """
    Parse a mapping target like "BISHOP" or "BISHOP § II" or "BISHOP § II. Bishop of Rome"
    and return (display_title, entry_or_subsection_view, missing_reason).

    For a subsection target, returns a synthesized view {intro, quotes, see_also} that
    looks like a regular entry but contains only the matching subsection.
    """
    if "§" in spec:
        base, sub_spec = [s.strip() for s in spec.split("§", 1)]
    else:
        base, sub_spec = spec, None

    entry = entries.get(base)
    if entry is None:
        return spec, None, f"entry '{base}' not found"

    if sub_spec is None:
        return base, entry, None

    # Match subsection. Roman-numeral targets must match the leading numeral exactly
    # (e.g. "V" should not match "IV. ..."). Other targets fall back to substring.
    sub_norm = sub_spec.upper().rstrip(".").strip()
    is_roman_only = bool(re.fullmatch(r"[IVXLCDM]+", sub_norm))
    matched = None
    for sub in entry["subsections"]:
        title_upper = sub["title"].upper().strip()
        m = re.match(r"^([IVXLCDM]+)\.", title_upper)
        if is_roman_only:
            if m and m.group(1) == sub_norm:
                matched = sub
                break
        else:
            if title_upper.startswith(sub_norm + ".") or sub_norm in title_upper:
                matched = sub
                break
    if matched is None:
        return spec, None, f"subsection '{sub_spec}' not found in {base}"

    return f"{base} § {matched['title']}", {
        "intro": "",
        "quotes": matched["quotes"],
        "subsections": [],
        "see_also": matched.get("see_also"),
        "source_file": entry.get("source_file"),
    }, None


def split_attribution(p_tag) -> tuple[str, str | None]:
    """
    Find the trailing <em class="calibre6">Author (date, region), vol.page.</em>
    inside a <p>. Return (quote_text_without_attribution, attribution) or
    (full_text, None) if no attribution found (Scripture or unattributed).
    """
    # Find last <em class="calibre6"> child whose text matches attribution pattern.
    ems = p_tag.find_all("em", class_="calibre6")
    if not ems:
        return normalize_ws(p_tag.get_text()), None
    last_em = ems[-1]
    em_text = normalize_ws(last_em.get_text())
    m = ATTR_RE.match(em_text)
    if not m:
        return normalize_ws(p_tag.get_text()), None
    # Strip the attribution from the paragraph
    last_em.extract()
    quote = normalize_ws(p_tag.get_text())
    # Trim trailing whitespace/punctuation artifacts left behind
    quote = re.sub(r"\s+$", "", quote)
    return quote, em_text


# -----------------------------------------------------------------------------
# Dedup against existing quotes.json
# -----------------------------------------------------------------------------

def normalize_for_dedup(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    # remove bracketed editorial inserts e.g. "[in baptism, Col 2:11–12]"
    s = re.sub(r"\[[^\]]*\]", " ", s)
    # collapse ellipses, em/en dashes
    s = re.sub(r"\.{2,}", " ", s)
    s = re.sub(r"[–—…]", " ", s)
    # strip punctuation
    s = re.sub(r"[^a-zA-Z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def load_existing_quotes() -> list[dict]:
    data = json.loads((REPO / "src/lib/data/quotes.json").read_text())
    return [{"id": q["id"], "norm": normalize_for_dedup(q.get("en") or "")} for q in data if q.get("en")]


def find_dedup_match(harvested_en: str, existing: list[dict]) -> int | None:
    h = normalize_for_dedup(harvested_en)
    if len(h) < 40:
        return None
    for ex in existing:
        if not ex["norm"]:
            continue
        # substring either direction
        if h in ex["norm"] or ex["norm"] in h:
            return ex["id"]
        # 60-char prefix overlap is a strong signal (Bercot often abbreviates with ellipses)
        prefix = h[:60]
        if prefix and prefix in ex["norm"]:
            return ex["id"]
    return None


# -----------------------------------------------------------------------------
# Rendering
# -----------------------------------------------------------------------------

def md_escape_inline(s: str) -> str:
    # Markdown inside a blockquote — just normalize whitespace
    return re.sub(r"\s+", " ", s).strip()


def render_topic_md(topic: dict, mapped: list[tuple[str, str]], entries: dict, existing: list[dict]) -> tuple[str, dict]:
    """Return (markdown, stats)."""
    lines: list[str] = []
    n = topic["id"]
    label = topic["label"]
    slug = topic["slug"]
    groupe = topic["groupe"]
    overall_conf = max_conf(mapped)

    lines.append(f"# {n:02d} · {label}  ({slug})")
    lines.append("")
    lines.append(f"**Site group:** {groupe}  ")
    lines.append(f"**Mapped dictionary entries:** {', '.join(t for t, _ in mapped) or '_none_'}  ")
    lines.append(f"**Mapping confidence:** {overall_conf}")

    total_quotes = 0
    matched_quotes = 0
    sections: list[str] = []
    missing: list[str] = []
    rendered_targets: set[str] = set()
    redirected_only: list[tuple[str, str]] = []  # (alias, target)

    quote_counter = [0]  # mutable to share with helper

    def emit_quote_blocks(quotes: list[dict], heading: str = "###") -> list[str]:
        nonlocal matched_quotes, total_quotes
        out: list[str] = []
        if not quotes:
            out.append("_(no attributed quotes in this entry/subsection)_")
            out.append("")
            return out
        for q in quotes:
            quote_counter[0] += 1
            total_quotes += 1
            hit = find_dedup_match(q["text"], existing)
            tag = f"  `[already on site → quote #{hit}]`" if hit else ""
            if hit:
                matched_quotes += 1
            out.append(f"{heading} Quote {quote_counter[0]}{tag}")
            out.append("")
            out.append(f"> {md_escape_inline(q['text'])}")
            out.append("")
            out.append(f"**Attribution:** {q['attribution']}")
            out.append("")
        return out

    for toc_spec, conf in mapped:
        display_title, entry, miss_reason = resolve_target(toc_spec, entries)
        if entry is None:
            missing.append(f"{toc_spec} ({miss_reason})")
            continue

        # Pure cross-reference entry (no quotes/subsections + SEE redirect)
        is_xref = (
            not entry["quotes"]
            and not entry["subsections"]
            and entry["see_also"]
            and not re.match(r"\s*SEE\s+ALSO", entry["see_also"], re.IGNORECASE)
        )
        if is_xref:
            raw = re.sub(r"^\s*SEE\s+", "", entry["see_also"], flags=re.IGNORECASE).rstrip(".").strip()
            # Multi-target cross-refs split by ";"
            raw_targets = [t.strip() for t in raw.split(";") if t.strip()]
            parsed_targets: list[tuple[str, str]] = []  # (base, redirect_spec)
            for rt in raw_targets:
                sect_match = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", rt)
                if sect_match:
                    base = sect_match.group(1).strip()
                    sub = sect_match.group(2).strip()
                    parsed_targets.append((base, f"{base} § {sub}"))
                else:
                    parsed_targets.append((rt, rt))

            mapped_bases = {t.split("§")[0].strip() for t, _ in mapped}
            # Fold silently if ANY target is already mapped for this topic
            if any(b in mapped_bases or spec in rendered_targets for b, spec in parsed_targets):
                redirected_only.append((display_title, " / ".join(spec for _, spec in parsed_targets)))
                continue

            specs_str = "; ".join(f"**{spec}**" for _, spec in parsed_targets)
            sections.append(
                f"\n---\n\n## from {display_title}  _(confidence: {conf})_\n\n"
                f"_Cross-reference → {specs_str}. See that/those entries in Bercot directly._\n"
            )
            continue

        key = display_title
        if key in rendered_targets:
            redirected_only.append((toc_spec, key))
            continue
        rendered_targets.add(key)

        section_lines: list[str] = ["", "---", "", f"## from {display_title}  _(confidence: {conf})_", ""]
        if entry["intro"]:
            for para in entry["intro"].split("\n\n"):
                section_lines.append(f"> {md_escape_inline(para)}")
                section_lines.append(">")
            while section_lines and section_lines[-1] == ">":
                section_lines.pop()
            section_lines.append("")

        if entry["subsections"]:
            for sub in entry["subsections"]:
                section_lines.append(f"### § {sub['title']}")
                section_lines.append("")
                section_lines.extend(emit_quote_blocks(sub["quotes"], heading="####"))
                if sub.get("see_also"):
                    section_lines.append(f"_{sub['see_also']}_")
                    section_lines.append("")
        else:
            section_lines.extend(emit_quote_blocks(entry["quotes"]))

        if entry["see_also"] and "SEE ALSO" in entry["see_also"].upper():
            section_lines.append(f"_{entry['see_also']}_")
            section_lines.append("")
        sections.append("\n".join(section_lines))

    lines.append(f"**Quotes harvested:** {total_quotes}" + (f" ({matched_quotes} already on site)" if matched_quotes else ""))
    lines.append("")
    if overall_conf in ("low", "medium") and any(c == "low" for _, c in mapped):
        lines.append("> ⚠️ Review mapping — contains low-confidence entries.")
        lines.append("")
    if missing:
        lines.append(f"> ⚠️ Missing entries (not found in EPUB): {', '.join(missing)}")
        lines.append("")
    if redirected_only:
        alias_strs = [f"{a} → {t}" for a, t in redirected_only]
        lines.append(f"_Cross-reference aliases folded in: {'; '.join(alias_strs)}_")
        lines.append("")
    for sec in sections:
        lines.append(sec)
    md = "\n".join(lines).rstrip() + "\n"
    return md, {"total": total_quotes, "matched": matched_quotes, "missing": missing}


CONF_RANK = {"high": 3, "medium": 2, "low": 1}


def max_conf(mapped: list[tuple[str, str]]) -> str:
    if not mapped:
        return "n/a"
    return max(mapped, key=lambda x: CONF_RANK[x[1]])[1]


def count_entry_quotes(entry: dict, entries: dict, _depth: int = 0) -> int:
    """Count attributed quotes for an entry, summing subsections and following one
    level of SEE redirect (with optional (section) hint)."""
    if entry is None or _depth > 2:
        return 0
    n = len(entry["quotes"]) + sum(len(s["quotes"]) for s in entry["subsections"])
    if n > 0:
        return n
    sa = entry.get("see_also") or ""
    if not sa or re.match(r"\s*SEE\s+ALSO", sa, re.IGNORECASE):
        return 0
    raw = re.sub(r"^\s*SEE\s+", "", sa, flags=re.IGNORECASE).rstrip(".").strip()
    # Take only the first target if multiple
    first = raw.split(";")[0].strip()
    sect_match = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", first)
    if sect_match:
        base = sect_match.group(1).strip()
        sub = sect_match.group(2).strip()
        _, view, _ = resolve_target(f"{base} § {sub}", entries)
        if view:
            return len(view["quotes"]) + sum(len(s["quotes"]) for s in view["subsections"])
    target_entry = entries.get(first)
    if target_entry:
        return count_entry_quotes(target_entry, entries, _depth + 1)
    return 0


def render_candidates(entries: dict, consumed: set[str]) -> tuple[str, int]:
    rows: list[tuple[str, int, str, str]] = []
    for title, why in CANDIDATES.items():
        if title in consumed:
            continue
        entry = entries.get(title)
        if entry is None:
            continue
        n_quotes = count_entry_quotes(entry, entries)
        intro = entry["intro"].split("\n\n")[0] if entry["intro"] else ""
        intro_short = (intro[:160] + "…") if len(intro) > 160 else intro
        rows.append((title, n_quotes, why, intro_short.replace("|", "\\|")))
    rows.sort(key=lambda r: (-r[1], r[0]))
    lines = [
        "# Candidate new topics from Bercot",
        "",
        "Generated by `scripts/bercot-harvest.py`.",
        "Filter: doctrines + Catholic practice/spirituality (hand-curated allowlist).",
        "TOC entries already consumed by the 49 site topics are excluded.",
        "",
        "| TOC entry | Quotes | Why it fits | Bercot intro snippet |",
        "| --- | ---: | --- | --- |",
    ]
    for title, n_quotes, why, intro in rows:
        lines.append(f"| {title} | {n_quotes} | {why} | {intro} |")
    lines.append("")
    return "\n".join(lines), len(rows)


def render_readme(per_topic_stats: dict[str, dict], n_candidates: int) -> str:
    lines = [
        "# Bercot Dictionary Harvest",
        "",
        "Research corpus extracted from David W. Bercot, *A Dictionary of Early",
        "Christian Beliefs* (Hendrickson, 2014 eBook). Generated by",
        "`scripts/bercot-harvest.py` per the spec at",
        "`docs/superpowers/specs/2026-05-25-bercot-harvest-design.md`.",
        "",
        "**Citation format used by Bercot:** `Author (date, region), vol.page.` —",
        "the volume/page refer to the *Ante-Nicene Fathers* (Roberts–Donaldson, ed.",
        "Coxe). `E` = Eastern Father, `W` = Western Father.",
        "",
        "## Contents",
        "",
        "- `topics/NN-slug.md` — 49 files, one per site topic, with mapped Bercot",
        "  entries, intro paragraph(s), and attributed quotes. Quotes already present",
        "  in `src/lib/data/quotes.json` are flagged inline with",
        "  `[already on site → quote #N]`.",
        f"- `candidates.md` — {n_candidates} candidate new topics for the site,",
        "  drawn from a hand-curated allowlist of Catholic doctrines + practice.",
        "",
        "## Per-topic harvest totals",
        "",
        "| # | Topic | Quotes | Already on site |",
        "| ---: | --- | ---: | ---: |",
    ]
    for slug, st in per_topic_stats.items():
        lines.append(f"| {st['id']:02d} | {st['label']} | {st['total']} | {st['matched']} |")
    grand_total = sum(s["total"] for s in per_topic_stats.values())
    grand_matched = sum(s["matched"] for s in per_topic_stats.values())
    lines.append(f"| | **Total** | **{grand_total}** | **{grand_matched}** |")
    lines.append("")
    return "\n".join(lines)


# -----------------------------------------------------------------------------
# JSON emission
# -----------------------------------------------------------------------------

def collect_json_rows(
    entries: dict,
    existing_quotes: list[dict],
    topics_by_slug: dict,
) -> list[dict]:
    """Walk MAPPING + CANDIDATES, materialize every harvested quote as a JSON row.

    Each row carries a stable hash id derived from (entry, subsection, attribution,
    english text). The same row id will reappear on re-runs as long as Bercot's
    text hasn't changed — user-edited fields can be merged in via merge_json_rows.
    """
    rows: list[dict] = []
    seen: set[str] = set()

    def emit_from(entry_view: dict, source_entry: str, subsection: str | None,
                  mapped_topic_ids: list[int]) -> None:
        for q in entry_view["quotes"]:
            if not q["text"].strip():
                continue  # skip quotes with empty English text (schema requires min(1))
            rid = stable_id(source_entry, subsection, q["attribution"], q["text"])
            if rid in seen:
                continue
            seen.add(rid)
            dedup_match = find_dedup_match(q["text"], existing_quotes)
            row = {
                "id": rid,
                "sourceEntry": source_entry,
                "attribution": q["attribution"],
                "en": q["text"],
                "mappedTopicIds": list(mapped_topic_ids),
                "status": "pending",
            }
            if subsection:
                row["subsection"] = subsection
            if dedup_match is not None:
                row["dedupMatch"] = dedup_match
                row["siteQuoteId"] = dedup_match
                row["status"] = "published"
            rows.append(row)

    for slug, mapped in MAPPING.items():
        topic = topics_by_slug.get(slug)
        if topic is None:
            continue
        topic_id = topic["id"]
        for spec, _conf in mapped:
            display_title, view, _ = resolve_target(spec, entries)
            if view is None:
                continue
            if view["subsections"]:
                for sub in view["subsections"]:
                    emit_from({"quotes": sub["quotes"]}, display_title.split(" § ")[0],
                              sub["title"], [topic_id])
            else:
                base = display_title.split(" § ")[0]
                sub_title = display_title.split(" § ", 1)[1] if " § " in display_title else None
                emit_from(view, base, sub_title, [topic_id])

    consumed = {t for mapped in MAPPING.values() for t, _ in mapped}
    consumed_bases = {c.split("§")[0].strip() for c in consumed}
    for cand_title in CANDIDATES:
        if cand_title in consumed_bases:
            continue
        entry = entries.get(cand_title)
        if entry is None:
            continue
        if entry["subsections"]:
            for sub in entry["subsections"]:
                emit_from({"quotes": sub["quotes"]}, cand_title, sub["title"], [])
        else:
            emit_from(entry, cand_title, None, [])

    return rows


def merge_json_rows(fresh: list[dict], path: Path) -> list[dict]:
    """If a previous bercot.json exists, preserve user-edited fields per id.

    Preserved fields: fr, latin, greek, context, authorId, workId, studyTitle,
    migne, linksPrimary, linksArchive, notes, status (unless previous was
    'pending'), mappedTopicIds, siteQuoteId. Refreshed fields: sourceEntry,
    subsection, attribution, en, dedupMatch.

    Orphan preservation: rows present in the previous file but absent from `fresh`
    (e.g. a MAPPING tweak made them unreachable, or a Bercot text change shifted
    the stable_id) are kept at the tail of the output, untouched. A user's manual
    French translation is never lost without a console warning.
    """
    if not path.exists():
        return fresh
    try:
        existing = json.loads(path.read_text())
    except Exception:
        return fresh
    by_id = {r["id"]: r for r in existing if isinstance(r, dict) and "id" in r}
    fresh_ids = {row["id"] for row in fresh}
    out: list[dict] = []
    for row in fresh:
        prev = by_id.get(row["id"])
        if prev is None:
            out.append(row)
            continue
        merged = dict(row)
        # One-shot rename: sourceUrl → linksPrimary
        if "sourceUrl" in prev and "linksPrimary" not in prev:
            merged["linksPrimary"] = prev["sourceUrl"]

        # Preserve user-curated fields (extended list — match the schema's user-editable fields)
        for field in ("fr", "latin", "greek", "context", "authorId", "workId",
                      "studyTitle", "migne", "linksPrimary", "linksArchive", "notes"):
            if field in prev:
                merged[field] = prev[field]
        if "status" in prev and prev["status"] != "pending":
            merged["status"] = prev["status"]
        if "siteQuoteId" in prev:
            merged["siteQuoteId"] = prev["siteQuoteId"]
        if "mappedTopicIds" in prev:
            merged["mappedTopicIds"] = prev["mappedTopicIds"]
        out.append(merged)

    orphans = [r for r in existing if isinstance(r, dict) and r.get("id") not in fresh_ids]
    if orphans:
        edited_orphans = [o for o in orphans if any(o.get(f) for f in ("fr", "latin", "greek", "context", "authorId", "workId", "studyTitle", "migne", "linksPrimary", "linksArchive", "notes"))]
        print(
            f"  ! preserved {len(orphans)} orphan row(s) from previous bercot.json "
            f"(rows in prior file but not in this harvest); "
            f"{len(edited_orphans)} had user edits"
        )
        out.extend(orphans)
    return out


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main() -> int:
    args = parse_args()
    emit_json = args.emit_json or not args.emit_md
    emit_md = args.emit_md

    if not EPUB.exists():
        print(f"EPUB not found: {EPUB}", file=sys.stderr)
        return 1

    if emit_md:
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "topics").mkdir(exist_ok=True)

    with tempfile.TemporaryDirectory() as td:
        epub_root = Path(td)
        print(f"[1/6] Unzipping EPUB to {epub_root}…")
        unzip_epub(EPUB, epub_root)

        print("[2/6] Parsing entries from HTML…")
        entries = collect_entries(epub_root)
        print(f"      → {len(entries)} entries parsed")

        print("[3/6] Loading existing quotes.json for dedup…")
        existing = load_existing_quotes()
        print(f"      → {len(existing)} existing English quotes indexed")

        print("[4/6] Loading site topics…")
        topics = json.loads((REPO / "src/lib/data/topics.json").read_text())
        topics_by_slug = {t["slug"]: t for t in topics}

        if emit_md:
            print("[5/6] Rendering per-topic Markdown…")
            per_topic_stats: dict[str, dict] = {}
            all_missing: list[tuple[str, list[str]]] = []
            for slug, mapped in MAPPING.items():
                topic = topics_by_slug.get(slug)
                if topic is None:
                    print(f"      ! unknown site slug in mapping: {slug}", file=sys.stderr)
                    continue
                md, stats = render_topic_md(topic, mapped, entries, existing)
                path = OUT / "topics" / f"{topic['id']:02d}-{slug}.md"
                path.write_text(md)
                per_topic_stats[slug] = {**stats, "id": topic["id"], "label": topic["label"]}
                if stats["missing"]:
                    all_missing.append((slug, stats["missing"]))

            # Sort stats by topic id for the README
            per_topic_stats = dict(sorted(per_topic_stats.items(), key=lambda kv: kv[1]["id"]))

            consumed = {t for mapped in MAPPING.values() for t, _ in mapped}

            print("[6/6] Rendering candidates.md and README.md…")
            candidates_md, n_candidates = render_candidates(entries, consumed)
            (OUT / "candidates.md").write_text(candidates_md)
            (OUT / "README.md").write_text(render_readme(per_topic_stats, n_candidates))

            # Diagnostics
            if all_missing:
                print("\n  TOC entries referenced in MAPPING but NOT found in EPUB:")
                for slug, miss in all_missing:
                    print(f"    - {slug}: {', '.join(miss)}")

            grand_total = sum(s["total"] for s in per_topic_stats.values())
            grand_matched = sum(s["matched"] for s in per_topic_stats.values())
            print(f"\nDone. {grand_total} quotes harvested across {len(per_topic_stats)} topics "
                  f"({grand_matched} already on site). {n_candidates} new-topic candidates.")
            print(f"Output: {OUT}")

        if emit_json:
            rows = collect_json_rows(entries, existing, topics_by_slug)
            merged = merge_json_rows(rows, BERCOT_JSON_PATH)
            BERCOT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
            BERCOT_JSON_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")
            print(f"\nEmitted {len(merged)} rows to {BERCOT_JSON_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
