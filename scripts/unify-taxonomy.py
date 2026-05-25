#!/usr/bin/env python3
"""
One-shot migration: unify the 49 OG site topics + 149 Bercot dictionary entries
into a single classified taxonomy in src/lib/data/topics.json, and rebuild
src/lib/data/bercot.json's mappedTopicIds to point at the unified taxonomy.

Run: python3 scripts/unify-taxonomy.py

Idempotent: re-runs preserve the OG topic ids (≤49), only add/update topics
above id 49. Bercot mappedTopicIds are rebuilt from sourceEntry+subsection
on every run.

Editorial decisions (pillar, parent, label, dupe-detection) are inline below.
Tweak via /admin/sujets after running.
"""

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TOPICS_PATH = REPO / "src/lib/data/topics.json"
BERCOT_PATH = REPO / "src/lib/data/bercot.json"

# ---------------------------------------------------------------------------
# OG topic classification: assign pillar + parent (other OG slug) to each.
# Pillars are mutually exclusive: a topic belongs to one of Credo, Sacrements,
# Vie en Christ, Prière.
# Parent: slug of another OG topic (sub-topic relationship), or None (top-level).
# A sub-topic inherits its pillar from its parent in the UI; we still set it
# for safety.
# ---------------------------------------------------------------------------

# OG slug → (pillar, parent_slug | None)
OG_CLASSIFY: dict[str, tuple[str, str | None]] = {
    # Dieu
    "seul-vrai-dieu":                  ("credo", None),
    "dieu-n-a-pas-de-corps":           ("credo", "seul-vrai-dieu"),
    # Trinité
    "trinite":                         ("credo", None),
    "trois-personnes-de-la-trinite":   ("credo", "trinite"),
    "filioque":                        ("credo", "trinite"),
    # Christ
    "divinite-du-christ":              ("credo", None),
    "filiation-eternelle-du-christ":   ("credo", "divinite-du-christ"),
    # Création
    "creation-ex-nihilo":              ("credo", None),
    "creation-dans-la-genese":         ("credo", "creation-ex-nihilo"),
    # Sources de la foi
    "canon-des-ecritures":             ("credo", None),
    "tradition-apostolique":           ("credo", None),
    # Église
    "eglise-catholique":               ("credo", None),
    "succession-apostolique":          ("credo", "eglise-catholique"),
    # Pierre et la Papauté
    "pierre-le-roc":                   ("credo", None),
    "primaute-de-pierre":              ("credo", "pierre-le-roc"),
    "pierre-a-rome":                   ("credo", "pierre-le-roc"),
    "successeurs-de-pierre":           ("credo", "pierre-le-roc"),
    "autorite-du-pape":                ("credo", "pierre-le-roc"),
    # Morale
    "peche-mortel":                    ("vie",   None),
    "avortement":                      ("vie",   None),
    "contraception-et-la-sterilisation":("vie",  None),
    "homosexualite":                   ("vie",   None),
    "astrologie":                      ("vie",   None),
    # Baptême
    "bapteme-comme-moyen-de-grace":    ("sacrements", None),
    "regeneration-baptismale":         ("sacrements", "bapteme-comme-moyen-de-grace"),
    "necessite-du-bapteme":            ("sacrements", "bapteme-comme-moyen-de-grace"),
    "bapteme-trinitaire":              ("sacrements", "bapteme-comme-moyen-de-grace"),
    "bapteme-des-enfants":             ("sacrements", "bapteme-comme-moyen-de-grace"),
    # Autres sacrements
    "confirmation":                    ("sacrements", None),
    "presence-reelle":                 ("sacrements", None),
    "sacrifice-de-la-messe":           ("sacrements", "presence-reelle"),
    "confession":                      ("sacrements", None),
    "eveque-pretre-et-diacre":         ("sacrements", None),
    "femmes-pretres":                  ("sacrements", "eveque-pretre-et-diacre"),
    "permanence-du-mariage":           ("sacrements", None),
    "sabbat-ou-dimanche":              ("sacrements", None),
    # Marie
    "marie-pleine-de-grace":           ("credo", None),
    "marie-mere-de-dieu":              ("credo", "marie-pleine-de-grace"),
    "marie-toujours-vierge":           ("credo", "marie-pleine-de-grace"),
    # Saints / miracles / révélation
    "intercession-des-saints":         ("priere", None),
    "miracles-continus":               ("credo", None),
    "revelation-privee":               ("credo", None),
    # Fins dernières
    "salut-en-dehors-de-l-eglise":     ("credo", None),
    "recompense-et-le-merite":         ("credo", None),
    "purgatoire":                      ("credo", None),
    "enfer":                           ("credo", None),
    "reincarnation":                   ("credo", None),
    "resurrection-des-corps":          ("credo", None),
    "antechrist":                      ("credo", None),
}

# ---------------------------------------------------------------------------
# Bercot sourceEntry → unified taxonomy action.
#
# Action forms:
#   ("dupe", "og-slug")              absorbs into an existing OG topic
#   ("new", "fr-label", "pillar", parent_slug_or_None)
#                                    creates a new topic; parent may be an
#                                    OG slug OR another NEW slug declared
#                                    elsewhere in this map (forward refs OK).
#
# The new topic's slug is auto-generated from the source entry name; you can
# rename it via /admin/sujets after.
# ---------------------------------------------------------------------------

# Some Bercot entries with internal subsections map differently per subsection.
# These override the entry-level mapping below.
# Key: (sourceEntry, subsection_title) → og-slug-or-new-slug
SUBSECTION_OVERRIDES: dict[tuple[str, str], str] = {
    ("BAPTISM", "I. Meaning of baptism"):                       "bapteme-comme-moyen-de-grace",
    ("BAPTISM", "II. Mode and description of baptism"):         "bapteme-trinitaire",
    ("BAPTISM", "III. The question of infant baptism"):         "bapteme-des-enfants",
    ("CHRIST, DIVINITY OF", "I. Divinity of the Son"):          "divinite-du-christ",
    ("CHRIST, DIVINITY OF", "II. Begetting of the Son"):        "filiation-eternelle-du-christ",
    ("BISHOP", "I. Position, qualifications, and authority"):   "eveque-pretre-et-diacre",
    ("BISHOP", "II. Bishop of Rome"):                           "successeurs-de-pierre",
    ("CHURCHES, APOSTOLIC", "VI. Church at Rome"):              "pierre-a-rome",
    ("PRAYER", "V. Should Christians pray to angels and saints?"): "intercession-des-saints",
    ("PRAYER", "VI. Should Christians pray for the dead?"):     "purgatoire",
    ("PRAYER", "VII. Should Christians pray to the dead?"):     "intercession-des-saints",
    ("SIN", "I. Classes of sin"):                               "peche-mortel",
    ("SIN", "II. Unforgivable sin"):                            "peche-mortel",
    ("SALVATION", "I. Salvation through Christ alone"):         "salut-en-dehors-de-l-eglise",
    ("SALVATION", "III. Role of obedience in salvation"):       "recompense-et-le-merite",
    ("TRADITION", "II. Apostolic tradition"):                   "tradition-apostolique",  # default; I. unused
    ("MARTYRS, MARTYRDOM", "III. Baptism of blood"):            "bapteme-comme-moyen-de-grace",
    ("MARTYRS, MARTYRDOM", "IV. Honor of Martyrs"):             "intercession-des-saints",
}

# Bercot sourceEntry → entry-level mapping
BERCOT_MAP: dict[str, tuple] = {
    # ===== Dupes of existing OG topics =====
    "ABORTION, INFANTICIDE":           ("dupe", "avortement"),
    "CHRIST, DIVINITY OF":             ("dupe", "divinite-du-christ"),  # entry-level fallback; subsections route to §I (divinité) and §II (filiation)
    "LOGOS":                           ("dupe", "filiation-eternelle-du-christ"),
    "VICAR OF CHRIST":                 ("dupe", "autorite-du-pape"),
    "PREACHING":                       ("new", "La prédication", "sacrements", "eveque-pretre-et-diacre"),
    "ANTHROPOMORPHISMS":               ("dupe", "dieu-n-a-pas-de-corps"),
    "ANTICHRIST":                      ("dupe", "antechrist"),
    "APOSTOLIC SUCCESSION":            ("dupe", "succession-apostolique"),
    "ASTROLOGY":                       ("dupe", "astrologie"),
    "CHURCH GOVERNMENT":               ("dupe", "eveque-pretre-et-diacre"),
    "CHURCH, THE":                     ("dupe", "eglise-catholique"),
    "CONFESSION OF SINS":              ("dupe", "confession"),
    "CREATION":                        ("dupe", "creation-ex-nihilo"),
    "DAYS OF CREATION":                ("dupe", "creation-dans-la-genese"),
    "SEVENTH DAY OF CREATION":         ("dupe", "creation-dans-la-genese"),
    "DEACON":                          ("dupe", "eveque-pretre-et-diacre"),
    "DEACONESS":                       ("dupe", "femmes-pretres"),
    "DEAD, INTERMEDIATE STATE OF THE": ("dupe", "purgatoire"),
    "DEAD, WORSHIP OF THE":            ("dupe", "intercession-des-saints"),
    "DIVORCE":                         ("dupe", "permanence-du-mariage"),
    "REMARRIAGE":                      ("dupe", "permanence-du-mariage"),
    "TWICE-MARRIED":                   ("dupe", "permanence-du-mariage"),
    "EUCHARIST":                       ("dupe", "presence-reelle"),
    "ETERNAL PUNISHMENTS AND REWARDS": ("dupe", "enfer"),
    "FATHER, GOD THE":                 ("dupe", "trois-personnes-de-la-trinite"),
    "FILIOQUE":                        ("dupe", "filioque"),
    "GIFTS OF THE SPIRIT":             ("dupe", "miracles-continus"),
    "GOD":                             ("dupe", "seul-vrai-dieu"),
    "GOD, ATTRIBUTES OF":              ("dupe", "seul-vrai-dieu"),
    "HEALING, DIVINE":                 ("dupe", "miracles-continus"),
    "HEARING FROM GOD":                ("dupe", "revelation-privee"),
    "HOMOSEXUALITY":                   ("dupe", "homosexualite"),
    "LORD’S DAY":                      ("dupe", "sabbat-ou-dimanche"),
    "EIGHTH DAY":                      ("dupe", "sabbat-ou-dimanche"),
    "SABBATH":                         ("dupe", "sabbat-ou-dimanche"),
    "MARRIAGE":                        ("dupe", "permanence-du-mariage"),
    "MARY":                            ("dupe", "marie-pleine-de-grace"),
    "MERIT":                           ("dupe", "recompense-et-le-merite"),
    "MIRACLES":                        ("dupe", "miracles-continus"),
    "PETER":                           ("dupe", "pierre-le-roc"),
    "PRESBYTER":                       ("dupe", "eveque-pretre-et-diacre"),
    "PROCREATION":                     ("dupe", "contraception-et-la-sterilisation"),
    "PROPHECY, PROPHETS":              ("dupe", "revelation-privee"),
    "REINCARNATION":                   ("dupe", "reincarnation"),
    "RESURRECTION OF THE DEAD":        ("dupe", "resurrection-des-corps"),
    "SODOM":                           ("dupe", "homosexualite"),
    "TRADITION":                       ("dupe", "tradition-apostolique"),
    "TRINITY":                         ("dupe", "trinite"),
    "VISIONS":                         ("dupe", "revelation-privee"),
    "DREAMS":                          ("dupe", "revelation-privee"),

    # ===== New topics — Credo / Dieu (children of seul-vrai-dieu) =====
    # (covered by ATTRIBUTES OF and GOD dupes above)

    # ===== New topics — Credo / Trinité (children of trinite) =====
    "HOLY SPIRIT":                     ("new", "Le Saint-Esprit", "credo", "trinite"),
    "MONARCHIANISM":                   ("new", "Le monarchianisme", "credo", "trinite"),

    # ===== New topics — Credo / Christ (children of divinite-du-christ) =====
    "INCARNATION":                     ("new", "L'Incarnation", "credo", "divinite-du-christ"),
    "WORD OF GOD (CHRIST)":            ("new", "Le Verbe — Parole de Dieu", "credo", "divinite-du-christ"),
    "BLOOD OF CHRIST":                 ("new", "Le sang du Christ", "credo", "divinite-du-christ"),
    "RESURRECTION OF CHRIST":          ("new", "La résurrection du Christ", "credo", "divinite-du-christ"),
    "DESCENT INTO HADES":              ("new", "La descente aux enfers", "credo", "divinite-du-christ"),
    "ATONEMENT":                       ("new", "La Rédemption — l'œuvre du Christ", "credo", "divinite-du-christ"),

    # ===== New topics — Credo / Marie (children of marie-pleine-de-grace) =====
    "THEOTOKOS":                       ("dupe", "marie-mere-de-dieu"),
    "VIRGIN BIRTH":                    ("dupe", "marie-toujours-vierge"),
    "MOTHER, SPIRITUAL":               ("new", "La maternité spirituelle (Église / Marie)", "credo", "marie-pleine-de-grace"),

    # ===== New topics — Credo / Église (children of eglise-catholique) =====
    "CHURCHES, APOSTOLIC":             ("new", "Les Églises apostoliques", "credo", "eglise-catholique"),
    "SCHISM":                          ("new", "Le schisme", "credo", "eglise-catholique"),
    "COUNCILS, CHURCH":                ("new", "Les conciles", "credo", "eglise-catholique"),
    "CREEDS, EARLY":                   ("new", "Les Credos primitifs", "credo", "eglise-catholique"),
    "APOSTOLIC FAITH":                 ("new", "La foi apostolique", "credo", "tradition-apostolique"),
    "BISHOP":                          ("dupe", "eveque-pretre-et-diacre"),  # entry-level dupe; subsections handle Bishop of Rome separately

    # ===== New topics — Credo / Pierre et la Papauté (children of pierre-le-roc) =====
    "BINDING AND LOOSING":             ("new", "Le pouvoir de lier et délier", "credo", "pierre-le-roc"),
    "KEYS OF THE KINGDOM":             ("new", "Les clés du Royaume", "credo", "pierre-le-roc"),
    "LINUS":                           ("new", "Saint Lin (successeur immédiat)", "credo", "pierre-le-roc"),

    # ===== New topics — Credo / Saints et martyrs =====
    "MARTYRS, MARTYRDOM":              ("new", "Le martyre", "credo", "intercession-des-saints"),
    "RELICS OF MARTYRS AND SAINTS":    ("new", "Les reliques", "credo", "intercession-des-saints"),
    "PERSECUTION":                     ("new", "La persécution", "credo", "intercession-des-saints"),

    # ===== New topics — Credo / Écritures et Tradition =====
    "SCRIPTURES":                      ("new", "Les Saintes Écritures", "credo", "canon-des-ecritures"),
    "CANON, NEW TESTAMENT":            ("new", "Le canon du Nouveau Testament", "credo", "canon-des-ecritures"),
    "CANON, OLD TESTAMENT":            ("new", "Le canon de l'Ancien Testament", "credo", "canon-des-ecritures"),
    "DEUTEROCANONICAL BOOKS":          ("new", "Les livres deutérocanoniques", "credo", "canon-des-ecritures"),

    # ===== New topics — Credo / Fins dernières =====
    "JUDGMENT, LAST":                  ("new", "Le Jugement dernier", "credo", "enfer"),
    "BEAST, THE":                      ("new", "La Bête de l'Apocalypse", "credo", "antechrist"),
    "MARK OF THE BEAST":               ("new", "La marque de la Bête", "credo", "antechrist"),
    "GEHENNA":                         ("new", "La géhenne", "credo", "enfer"),
    "TARTARUS":                        ("new", "Le Tartare", "credo", "enfer"),
    "UNCORRUPTED BODIES":              ("new", "Les corps incorruptibles", "credo", "resurrection-des-corps"),

    # ===== New topics — Credo / Salut =====
    "SALVATION":                       ("dupe", "salut-en-dehors-de-l-eglise"),  # subsections handle finer mapping
    "FAITH":                           ("new", "La foi", "credo", "salut-en-dehors-de-l-eglise"),
    "FREE WILL AND PREDESTINATION":    ("new", "Libre arbitre et prédestination", "credo", "recompense-et-le-merite"),
    "DEIFICATION OF MAN":              ("new", "La divinisation (théosis)", "credo", "salut-en-dehors-de-l-eglise"),
    "NEW BIRTH":                       ("new", "La nouvelle naissance", "credo", "regeneration-baptismale"),
    "PERFECTION, CHRISTIAN":           ("new", "La perfection chrétienne", "credo", "salut-en-dehors-de-l-eglise"),
    "SINLESSNESS":                     ("new", "L'impeccabilité", "credo", "salut-en-dehors-de-l-eglise"),
    "REPENTANCE":                      ("new", "La pénitence — repentir", "credo", "confession"),

    # ===== New topics — Credo / Hérésies =====
    "GNOSTICS, GNOSTICISM":            ("new", "Le gnosticisme", "credo", None),
    "MARCION":                         ("new", "Marcion", "credo", None),
    "MONTANISTS":                      ("new", "Le montanisme", "credo", None),
    "NOVATIAN, NOVATIANISTS":          ("new", "Novatien et les novatianistes", "credo", None),
    "ARIUS, ARIANISM":                 ("new", "Arius et l'arianisme", "credo", None),
    "HERESIES, HERETICS":              ("new", "Hérésies et hérétiques", "credo", None),

    # ===== New topics — Sacrements / Baptême (children of bapteme-comme-moyen-de-grace) =====
    # (BAPTISM itself handled via subsections; entry-level just routes anywhere)
    "BAPTISM":                         ("dupe", "bapteme-comme-moyen-de-grace"),

    # ===== New topics — Sacrements / Eucharistie (children of presence-reelle) =====
    "ALTAR":                           ("new", "L'autel", "sacrements", "presence-reelle"),
    "VESSELS, EUCHARISTIC":            ("new", "Les vases sacrés", "sacrements", "presence-reelle"),

    # ===== New topics — Sacrements / Pénitence =====
    "ABSOLUTION":                      ("new", "L'absolution", "sacrements", "confession"),
    "SIN":                             ("new", "Le péché", "credo", "peche-mortel"),
    "LAPSED":                          ("new", "Les lapsi (apostats sous persécution)", "sacrements", "confession"),

    # ===== New topics — Sacrements / Ordres (children of eveque-pretre-et-diacre) =====
    "ORDINATION":                      ("new", "L'ordination", "sacrements", "eveque-pretre-et-diacre"),
    "ACOLYTE":                         ("new", "L'acolyte", "sacrements", "eveque-pretre-et-diacre"),
    "SUBDEACON":                       ("new", "Le sous-diacre", "sacrements", "eveque-pretre-et-diacre"),
    "READER":                          ("new", "Le lecteur", "sacrements", "eveque-pretre-et-diacre"),
    "MINOR ORDERS":                    ("new", "Les ordres mineurs", "sacrements", "eveque-pretre-et-diacre"),
    "WOMEN":                           ("new", "La femme dans l'Église", "sacrements", "eveque-pretre-et-diacre"),
    "WIDOWS, ORDER OF":                ("new", "L'ordre des veuves", "sacrements", "eveque-pretre-et-diacre"),
    "VIRGINS, ORDER OF":               ("new", "L'ordre des vierges consacrées", "sacrements", "eveque-pretre-et-diacre"),
    "CELIBACY":                        ("new", "Le célibat", "sacrements", "eveque-pretre-et-diacre"),
    "SIMONY":                          ("new", "La simonie", "sacrements", "eveque-pretre-et-diacre"),

    # ===== New topics — Sacrements / Liturgie =====
    "LITURGY":                         ("new", "La liturgie", "sacrements", "sabbat-ou-dimanche"),
    "INCENSE":                         ("new", "L'encens", "sacrements", "sabbat-ou-dimanche"),
    "EASTER":                          ("new", "Pâques", "sacrements", "sabbat-ou-dimanche"),
    "PASCHAL CONTROVERSY":             ("new", "La controverse pascale", "sacrements", "sabbat-ou-dimanche"),
    "LENT":                            ("new", "Le carême", "sacrements", "sabbat-ou-dimanche"),
    "HOLY WEEK":                       ("new", "La Semaine Sainte", "sacrements", "sabbat-ou-dimanche"),
    "PENTECOST":                       ("new", "La Pentecôte", "sacrements", "sabbat-ou-dimanche"),
    "EPIPHANY":                        ("new", "L'Épiphanie", "sacrements", "sabbat-ou-dimanche"),
    "CALENDAR, CHRISTIAN":             ("new", "Le calendrier chrétien", "sacrements", "sabbat-ou-dimanche"),
    "VESTMENTS, RELIGIOUS":            ("new", "Les vêtements liturgiques", "sacrements", "sabbat-ou-dimanche"),
    "CANDLES":                         ("new", "Les cierges", "sacrements", "sabbat-ou-dimanche"),
    "VEIL":                            ("new", "Le voile", "sacrements", "sabbat-ou-dimanche"),
    "MORNING AND EVENING PRAYER":      ("new", "La prière du matin et du soir", "priere", "intercession-des-saints"),
    "AMEN":                            ("new", "L'« Amen »", "sacrements", "sabbat-ou-dimanche"),
    "SURSUM CORDA":                    ("new", "Sursum corda", "sacrements", "presence-reelle"),
    "WORSHIP, CHRISTIAN":              ("new", "Le culte chrétien", "sacrements", "sabbat-ou-dimanche"),
    "FOOTWASHING":                     ("new", "Le lavement des pieds", "sacrements", "sabbat-ou-dimanche"),
    "BURIAL AND FUNERAL PRACTICES OF CHRISTIANS": ("new", "Les rites funéraires", "sacrements", "sabbat-ou-dimanche"),
    "CHURCH BUILDINGS":                ("new", "Les édifices d'église", "sacrements", "sabbat-ou-dimanche"),
    "HANDS, LAYING ON OF":             ("new", "L'imposition des mains", "sacrements", "confirmation"),
    "OIL, ANOINTING WITH":             ("new", "L'onction (huile sainte)", "sacrements", "confirmation"),

    # ===== New topics — Vie en Christ / Morale =====
    "IDOLATRY":                        ("new", "L'idolâtrie", "vie", None),
    "IMAGES":                          ("new", "Les images saintes", "credo", None),  # doctrinal (vs idolatry)
    "LAW, NATURAL":                    ("new", "La loi naturelle", "vie", None),
    "OATHS":                           ("new", "Les serments", "vie", None),
    "USURY":                           ("new", "L'usure", "vie", None),
    "TITHES, TITHING":                 ("new", "La dîme", "vie", None),
    "FASTING":                         ("new", "Le jeûne", "vie", None),
    "ASCETICISM":                      ("new", "L'ascèse", "vie", None),

    # ===== New topics — Discipline ecclésiale =====
    "DISCIPLINE, CHURCH":              ("new", "La discipline de l'Église", "credo", "eglise-catholique"),

    # ===== New topics — Sacrements / divers =====
    "CATECHUMENS":                     ("new", "Les catéchumènes", "sacrements", "bapteme-comme-moyen-de-grace"),
    "GODPARENTS":                      ("new", "Les parrains et marraines", "sacrements", "bapteme-comme-moyen-de-grace"),
    "LOVE FEAST":                      ("new", "L'agape", "sacrements", "presence-reelle"),
    "SACRAMENTS":                      ("new", "Les sacrements (général)", "sacrements", None),
    "PRAYER":                          ("new", "La prière (général)", "priere", "intercession-des-saints"),
    "LORD’S PRAYER":                   ("new", "Le Notre Père", "priere", "intercession-des-saints"),
    "EXORCISM":                        ("new", "L'exorcisme", "sacrements", "confirmation"),

    # ===== Anthropologie chrétienne =====
    "SOUL":                            ("new", "L'âme", "credo", None),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(s: str) -> str:
    """ASCII kebab-case from a French or English string."""
    import unicodedata
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"['']", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def english_to_slug_fallback(entry: str) -> str:
    """For untranslated Bercot entries, derive a slug from the English name."""
    return slugify(entry)


def main() -> int:
    print(f"Reading {TOPICS_PATH}")
    topics: list[dict] = json.loads(TOPICS_PATH.read_text())

    # This is a ONE-SHOT migration. Refuse to run if topics.json already
    # has more than the 49 OG topics — the user has already migrated and
    # should curate via the admin from here on. To re-run, manually
    # `git checkout src/lib/data/topics.json` first.
    if len(topics) > 49:
        print(
            f"\nABORT: topics.json has {len(topics)} entries (>49). "
            "This script is a one-shot migration. If you want to re-run, "
            "first reset: `git checkout src/lib/data/topics.json`",
            file=sys.stderr,
        )
        return 2
    print(f"  {len(topics)} OG topics loaded")

    print(f"Reading {BERCOT_PATH}")
    bercot: list[dict] = json.loads(BERCOT_PATH.read_text())
    print(f"  {len(bercot)} Bercot rows loaded")

    # Index topics by slug for quick lookup
    by_slug: dict[str, dict] = {t["slug"]: t for t in topics}

    # ---------------------------------------------------------------------
    # Apply OG_CLASSIFY: set pillar + parentId on every OG topic
    # ---------------------------------------------------------------------
    for slug, (pillar, parent_slug) in OG_CLASSIFY.items():
        t = by_slug.get(slug)
        if t is None:
            print(f"  ! OG slug missing from topics.json: {slug}", file=sys.stderr)
            continue
        t["pillar"] = pillar
        if parent_slug:
            parent = by_slug.get(parent_slug)
            if parent is None:
                print(f"  ! OG parent slug missing: {parent_slug} (for {slug})", file=sys.stderr)
            else:
                t["parentId"] = parent["id"]
        else:
            t.pop("parentId", None)

    # ---------------------------------------------------------------------
    # Apply BERCOT_MAP: add new topics for "new" entries; track dupe→og mapping
    # ---------------------------------------------------------------------
    # First pass: register all NEW topics with provisional slugs (no parent yet)
    next_id = max(t["id"] for t in topics) + 1
    new_topic_slug_to_id: dict[str, int] = {}

    # Pre-validate: every BERCOT_MAP value points either to an existing OG slug
    # (for dupe) or a label/pillar (for new).
    for entry, action in BERCOT_MAP.items():
        if action[0] == "dupe":
            if action[1] not in by_slug:
                print(f"  ! BERCOT_MAP dupe target missing: {action[1]} (for {entry})", file=sys.stderr)

    # Add new topics
    for entry, action in BERCOT_MAP.items():
        if action[0] != "new":
            continue
        _, fr_label, pillar, _parent = action
        slug = slugify(fr_label)
        # Disambiguate slug collisions
        base, n = slug, 1
        while slug in by_slug or slug in new_topic_slug_to_id:
            n += 1
            slug = f"{base}-{n}"
        new_topic: dict = {
            "id": next_id,
            "slug": slug,
            "label": fr_label,
            "section": "I",  # placeholder; user can refine
            "groupe": _groupe_for_pillar(pillar),
            "pillar": pillar,
        }
        topics.append(new_topic)
        by_slug[slug] = new_topic
        new_topic_slug_to_id[entry] = next_id  # key by source entry for second-pass lookup
        # Also remember the FR slug → id for parent resolution
        new_topic_slug_to_id[slug] = next_id
        next_id += 1

    # Second pass: resolve parents for new topics
    for entry, action in BERCOT_MAP.items():
        if action[0] != "new":
            continue
        _, _fr_label, _pillar, parent_slug = action
        new_id = new_topic_slug_to_id[entry]
        new_topic = next(t for t in topics if t["id"] == new_id)
        if parent_slug:
            # parent_slug may refer to an OG slug or a new topic's FR slug;
            # in the FR-slug case we'd look it up in by_slug, which has both.
            parent = by_slug.get(parent_slug)
            if parent is None:
                print(f"  ! parent slug not found: {parent_slug} (for entry {entry})", file=sys.stderr)
            else:
                new_topic["parentId"] = parent["id"]

    # ---------------------------------------------------------------------
    # Add NEW Bercot-only top-level entries to topics.json if any sourceEntry
    # is not covered by either BERCOT_MAP or SUBSECTION_OVERRIDES
    # ---------------------------------------------------------------------
    covered = set(BERCOT_MAP.keys())
    seen_entries = {r["sourceEntry"] for r in bercot}
    uncovered = seen_entries - covered
    if uncovered:
        print(f"\n  ! Uncovered Bercot sourceEntries ({len(uncovered)}):")
        for u in sorted(uncovered):
            print(f"      - {u}")
        print("  These quotes will have empty mappedTopicIds. Add them to BERCOT_MAP and re-run.")

    # ---------------------------------------------------------------------
    # Rebuild bercot mappedTopicIds based on (sourceEntry, subsection)
    # ---------------------------------------------------------------------
    resolved_ids_changed = 0
    empty_count = 0
    for r in bercot:
        entry = r["sourceEntry"]
        sub = r.get("subsection")
        target_slug: str | None = None
        if sub and (entry, sub) in SUBSECTION_OVERRIDES:
            target_slug = SUBSECTION_OVERRIDES[(entry, sub)]
        elif entry in BERCOT_MAP:
            action = BERCOT_MAP[entry]
            if action[0] == "dupe":
                target_slug = action[1]
            elif action[0] == "new":
                # Find the slug we assigned to this entry
                new_id = new_topic_slug_to_id[entry]
                target_topic = next(t for t in topics if t["id"] == new_id)
                target_slug = target_topic["slug"]
        if target_slug is None:
            new_mapped: list[int] = []
            empty_count += 1
        else:
            target = by_slug.get(target_slug)
            if target is None:
                print(f"  ! Resolved target slug missing: {target_slug} (for entry {entry})", file=sys.stderr)
                new_mapped = []
            else:
                new_mapped = [target["id"]]
        if r.get("mappedTopicIds") != new_mapped:
            r["mappedTopicIds"] = new_mapped
            resolved_ids_changed += 1

    print(f"\n  Updated mappedTopicIds on {resolved_ids_changed} rows")
    print(f"  Empty mappedTopicIds: {empty_count}")

    # ---------------------------------------------------------------------
    # Write out
    # ---------------------------------------------------------------------
    TOPICS_PATH.write_text(json.dumps(topics, ensure_ascii=False, indent=2) + "\n")
    BERCOT_PATH.write_text(json.dumps(bercot, ensure_ascii=False, indent=2) + "\n")
    print(f"\nWrote {len(topics)} topics → {TOPICS_PATH}")
    print(f"Wrote {len(bercot)} bercot rows → {BERCOT_PATH}")
    return 0


def _groupe_for_pillar(pillar: str) -> str:
    return {
        "credo": "Credo",
        "sacrements": "Sacrements et liturgie",
        "vie": "Vie chrétienne",
        "priere": "Prière",
    }[pillar]


if __name__ == "__main__":
    sys.exit(main())
