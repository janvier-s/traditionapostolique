# Pères de l'Église v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 of "Pères de l'Église" — a French-first patristic anthology site organized topically, with a persistent collapsible sidebar, a study panel for each quote, a dev-only admin editor for the JSON data, and a build-time gaps report.

**Architecture:** Standalone SvelteKit 5 (runes-only) app, JSON data files in `src/lib/data/`, zod-validated at build, minisearch index emitted at prebuild. Reuses catechismecatholique design tokens, typography, and the Sidebar component family verbatim. Ports + adapts the StudyPanel from douayrheimsbible for the per-quote info panel. Deploys to Cloudflare Pages.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, Tailwind 3, TypeScript strict, zod, minisearch, vitest, playwright, @sveltejs/adapter-cloudflare, openpyxl-equivalent in Node (use `xlsx` package for the one-shot import).

**Reference repos** (referenced often):
- Sibling catechismecatholique repo: `/Users/Janvier/Documents/catechismecatholique`
- Sibling douayrheimsbible repo: `/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/douayrheimsbible`
- Source corpus xlsx: `/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/fathers/excel/fathers_db.xlsx`

**House conventions** (enforced everywhere):
- No em dashes (use middot `·`, comma, parentheses, or rewrite).
- No `§` in user-facing copy.
- No French thousand separators (`2865`, not `2 865`).
- User-facing copy is French.
- All Svelte components use runes only.

---

## File Structure

```
pereseglise/
├── .gitignore                                 [exists]
├── package.json                               [Task 1]
├── svelte.config.js                           [Task 1]
├── vite.config.ts                             [Task 1]
├── tsconfig.json                              [Task 1]
├── tailwind.config.cjs                        [Task 2]
├── postcss.config.cjs                         [Task 2]
├── eslint.config.js                           [Task 1]
├── .prettierrc                                [Task 1]
├── playwright.config.ts                       [Task 1]
├── wrangler.toml                              [Task 1]
├── _headers                                   [Task 1]
├── _redirects                                 [Task 1]
├── static/
│   ├── fonts/*.woff2                          [Task 3 — copied from catechismecatholique]
│   └── favicon.svg                            [Task 1]
├── src/
│   ├── app.html                               [Task 1]
│   ├── app.css                                [Task 3]
│   ├── app.d.ts                               [Task 1]
│   ├── hooks.server.ts                        [Task 1]
│   ├── lib/
│   │   ├── schema/                            [Task 6]
│   │   │   ├── author.ts
│   │   │   ├── work.ts
│   │   │   ├── topic.ts
│   │   │   ├── quote.ts
│   │   │   └── index.ts
│   │   ├── data/                              [Task 8]
│   │   │   ├── authors.json
│   │   │   ├── works.json
│   │   │   ├── topics.json
│   │   │   ├── quotes.json
│   │   │   └── index.ts                       [Task 9]
│   │   ├── utils/
│   │   │   ├── slug.ts                        [Task 10]
│   │   │   ├── era.ts                         [Task 11]
│   │   │   ├── quote-date.ts                  [Task 12]
│   │   │   ├── derive-quote-title.ts          [Task 13]
│   │   │   ├── format-citation.ts             [Task 14]
│   │   │   └── filters.ts                     [Task 15]
│   │   ├── stores/
│   │   │   ├── sidebar.ts                     [Task 20]
│   │   │   └── theme.ts                       [Task 5]
│   │   └── components/
│   │       ├── ui/                            [Tasks 5, 21, 22, 24, 28, 32]
│   │       └── peres/                         [Tasks 23, 25, 26, 27, 28, 29]
│   └── routes/
│       ├── +layout.svelte                     [Task 22]
│       ├── +layout.ts                         [Task 22]
│       ├── +page.svelte                       [Task 23]
│       ├── sujets/                            [Task 24]
│       ├── peres/                             [Task 25]
│       ├── oeuvres/                           [Task 26]
│       ├── recherche/                         [Task 30]
│       ├── citation/[id]/                     [Task 29]
│       ├── a-propos/                          [Task 31]
│       ├── mentions-legales/                  [Task 31]
│       ├── sitemap.xml/+server.ts             [Task 33]
│       ├── llms.txt/+server.ts                [Task 34]
│       └── admin/                             [Tasks 36-43]
├── scripts/
│   ├── import-xlsx.ts                         [Task 7]
│   ├── prebuild.ts                            [Tasks 16-19]
│   └── generate-og-image.mjs                  [Task 35]
├── tests/                                     [unit tests alongside their subject]
└── e2e/
    ├── sidebar.spec.ts                        [Task 21]
    ├── topic-page.spec.ts                     [Task 24]
    ├── study-panel.spec.ts                    [Task 28]
    ├── search.spec.ts                         [Task 30]
    └── admin-dev-only.spec.ts                 [Task 36]
```

---

## Phase A — Foundation

### Task 1: Scaffold SvelteKit project

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `playwright.config.ts`, `wrangler.toml`, `_headers`, `_redirects`, `src/app.html`, `src/app.d.ts`, `src/hooks.server.ts`, `static/favicon.svg`

- [ ] **Step 1: Copy configs verbatim from catechismecatholique, adapt names**

```bash
SRC="/Users/Janvier/Documents/catechismecatholique"
DST="/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise"

cp "$SRC/svelte.config.js" "$DST/"
cp "$SRC/vite.config.ts" "$DST/"
cp "$SRC/tsconfig.json" "$DST/"
cp "$SRC/eslint.config.js" "$DST/"
cp "$SRC/.prettierrc" "$DST/" 2>/dev/null || true
cp "$SRC/playwright.config.ts" "$DST/"
cp "$SRC/wrangler.toml" "$DST/"
cp "$SRC/_headers" "$DST/"
cp "$SRC/_redirects" "$DST/"
cp "$SRC/src/app.html" "$DST/src/"
cp "$SRC/src/app.d.ts" "$DST/src/"
cp "$SRC/src/hooks.server.ts" "$DST/src/" 2>/dev/null || true
cp "$SRC/static/favicon.svg" "$DST/static/" 2>/dev/null || true
```

- [ ] **Step 2: Write package.json (new, tailored to this project)**

```json
{
  "name": "pereseglise",
  "private": true,
  "version": "0.1.0",
  "description": "Anthologie patristique française organisée par sujets.",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "prebuild": "tsx scripts/prebuild.ts",
    "import-xlsx": "tsx scripts/import-xlsx.ts",
    "prepare": "svelte-kit sync || echo ''",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "lint": "prettier --check . && eslint .",
    "format": "prettier --write .",
    "test:unit": "vitest",
    "test": "npm run test:unit -- --run && npm run test:e2e",
    "test:e2e": "playwright install --with-deps chromium && playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.59.1",
    "@sveltejs/adapter-cloudflare": "^7.2.8",
    "@sveltejs/kit": "^2.57.0",
    "@sveltejs/vite-plugin-svelte": "^7.0.0",
    "@types/node": "^20",
    "autoprefixer": "^10.5.0",
    "eslint": "^10.2.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-svelte": "^3.17.0",
    "globals": "^17.4.0",
    "postcss": "^8.5.13",
    "prettier": "^3.8.1",
    "prettier-plugin-svelte": "^3.5.1",
    "sharp": "^0.34.5",
    "svelte": "^5.55.2",
    "svelte-check": "^4.4.6",
    "tailwindcss": "^3.4.19",
    "tsx": "^4.21.0",
    "typescript": "^6.0.2",
    "typescript-eslint": "^8.58.1",
    "vite": "^8.0.7",
    "vitest": "^4.1.3",
    "xlsx": "^0.20.3",
    "zod": "^3.24.1"
  },
  "dependencies": {
    "minisearch": "^7.2.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd "/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise"
npm install
```

Expected: install succeeds, `node_modules/` populated.

- [ ] **Step 4: Edit `wrangler.toml` to set the project name**

Find the `name = "catechismecatholique"` line and change to `name = "pereseglise"`.

- [ ] **Step 5: Edit `src/app.html`** — change `<title>` placeholder and the `<html lang="...">` to `lang="fr"`. Set the page title to `%sveltekit.head%` only and let routes set per-page titles via MetaTags.

- [ ] **Step 6: Verify scaffold builds**

```bash
npm run check
```
Expected: passes (zero errors). It's OK if `src/lib/` is empty so far — kit will sync types based on the empty routes tree.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold SvelteKit project from catechismecatholique configs"
```

---

### Task 2: Tailwind + PostCSS config

**Files:**
- Create: `tailwind.config.cjs`, `postcss.config.cjs`

- [ ] **Step 1: Copy from catechismecatholique**

```bash
cp "/Users/Janvier/Documents/catechismecatholique/tailwind.config.cjs" \
   "/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise/tailwind.config.cjs"
cp "/Users/Janvier/Documents/catechismecatholique/postcss.config.cjs" \
   "/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise/postcss.config.cjs"
```

The config already extends colors from CSS variables (`bg/fg/panel/accent/accent-text/muted/subtle/border/heading`), fontFamily from `--font-body / --font-ui / --font-heading`, and sets `maxWidth.reader: '750px'`. No changes needed.

- [ ] **Step 2: Verify config syntax**

```bash
npm run check
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.cjs postcss.config.cjs
git commit -m "chore: add Tailwind 3 + PostCSS config from catechismecatholique"
```

---

### Task 3: Webfonts + app.css theme tokens

**Files:**
- Copy: `static/fonts/*.woff2` (Gotham 5 weights × roman/italic + Libre Baskerville 3 weights)
- Create: `src/app.css`

- [ ] **Step 1: Copy fonts**

```bash
mkdir -p "/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise/static/fonts"
cp "/Users/Janvier/Documents/catechismecatholique/static/fonts/"*.woff2 \
   "/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise/static/fonts/"
```

- [ ] **Step 2: Create `src/app.css` by copying from catechismecatholique and trimming CCC-specific rules**

```bash
cp "/Users/Janvier/Documents/catechismecatholique/src/app.css" \
   "/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise/src/app.css"
```

Then open `src/app.css` and remove these CCC-specific blocks if present:
- Anything referencing `.cec-`, `.reader-prose`, CCC paragraph styles, print rules for CCC.
- Keep: `@font-face` declarations, `:root` and `.dark` variable blocks (light + sepia + dark + AMOLED), `--font-body / --font-ui / --font-heading` definitions, base typography, focus-visible rules.

If unsure whether a rule is CCC-specific, leave it — we can prune later.

- [ ] **Step 3: Verify dev server starts and shows fonts**

```bash
npm run dev
```

Open http://localhost:5173. Expected: blank page, no console errors, fonts load (check Network tab).

- [ ] **Step 4: Commit**

```bash
git add static/fonts src/app.css
git commit -m "feat: add Libre Baskerville + Gotham webfonts and theme tokens"
```

---

### Task 4: Base layout shell

**Files:**
- Create: `src/routes/+layout.svelte`, `src/routes/+layout.ts`, `src/routes/+page.svelte`

- [ ] **Step 1: Create `src/routes/+layout.ts`**

```ts
export const prerender = true;
export const trailingSlash = 'never';
```

- [ ] **Step 2: Create a minimal `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="min-h-screen bg-background text-foreground font-body">
	<header class="border-b border-border px-6 py-4">
		<a href="/" class="font-heading text-xl">Pères de l'Église</a>
	</header>
	<main>
		{@render children()}
	</main>
</div>
```

- [ ] **Step 3: Create placeholder `src/routes/+page.svelte`**

```svelte
<div class="p-6">
	<h1 class="font-heading text-3xl">Pères de l'Église</h1>
	<p class="mt-4">Bientôt disponible.</p>
</div>
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```

Open http://localhost:5173. Expected: see header + heading rendered in Baskerville/Gotham.

- [ ] **Step 5: Commit**

```bash
git add src/routes/+layout.svelte src/routes/+layout.ts src/routes/+page.svelte
git commit -m "feat: add base layout shell and placeholder home page"
```

---

### Task 5: Theme store + ThemeToggle

**Files:**
- Create: `src/lib/stores/theme.ts`, `src/lib/components/ui/ThemeToggle.svelte`
- Test: `src/lib/stores/theme.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/stores/theme.svelte.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('theme store', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		const storage: Record<string, string> = {};
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => storage[k] ?? null,
			setItem: (k: string, v: string) => { storage[k] = v; },
			removeItem: (k: string) => { delete storage[k]; }
		});
		vi.stubGlobal('document', { documentElement: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } } });
	});

	it('cycles through light / sepia / dark / amoled', async () => {
		const { theme, cycleTheme } = await import('./theme.svelte');
		expect(theme.value).toBe('light');
		cycleTheme();
		expect(theme.value).toBe('sepia');
		cycleTheme();
		expect(theme.value).toBe('dark');
		cycleTheme();
		expect(theme.value).toBe('amoled');
		cycleTheme();
		expect(theme.value).toBe('light');
	});

	it('persists choice to localStorage', async () => {
		const { cycleTheme } = await import('./theme.svelte');
		cycleTheme();
		expect(localStorage.getItem('theme')).toBe('sepia');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit -- src/lib/stores/theme.svelte.test.ts
```
Expected: FAIL with "Cannot find module './theme.svelte'".

- [ ] **Step 3: Implement the store**

`src/lib/stores/theme.svelte.ts` (the `.svelte.ts` extension is required for runes in non-component files):
```ts
export type Theme = 'light' | 'sepia' | 'dark' | 'amoled';
const ORDER: Theme[] = ['light', 'sepia', 'dark', 'amoled'];

function load(): Theme {
	if (typeof localStorage === 'undefined') return 'light';
	const v = localStorage.getItem('theme');
	return ORDER.includes(v as Theme) ? (v as Theme) : 'light';
}

function apply(t: Theme) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.classList.remove('sepia', 'dark', 'amoled');
	if (t !== 'light') root.classList.add(t);
}

export const theme = $state({ value: load() });

if (typeof document !== 'undefined') apply(theme.value);

export function setTheme(t: Theme) {
	theme.value = t;
	if (typeof localStorage !== 'undefined') localStorage.setItem('theme', t);
	apply(t);
}

export function cycleTheme() {
	const next = ORDER[(ORDER.indexOf(theme.value) + 1) % ORDER.length];
	setTheme(next);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:unit -- src/lib/stores/theme.svelte.test.ts
```
Expected: PASS.

- [ ] **Step 5: Create the toggle component**

`src/lib/components/ui/ThemeToggle.svelte`:
```svelte
<script lang="ts">
	import { theme, cycleTheme } from '$lib/stores/theme.svelte';
	const LABEL: Record<string, string> = {
		light: 'Clair', sepia: 'Sépia', dark: 'Sombre', amoled: 'AMOLED'
	};
</script>

<button
	type="button"
	onclick={cycleTheme}
	class="rounded border border-border bg-panel px-3 py-1 font-ui text-sm hover:bg-subtle/10"
	aria-label="Changer de thème"
>
	{LABEL[theme.value]}
</button>
```

- [ ] **Step 6: Wire it into the layout header**

In `src/routes/+layout.svelte`, import and place `<ThemeToggle />` to the right of the brand link.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stores/ src/lib/components/ui/ThemeToggle.svelte src/routes/+layout.svelte
git commit -m "feat: theme store + ThemeToggle (light/sepia/dark/amoled)"
```

---

## Phase B — Data schema and import

### Task 6: Zod schemas for the four entities

**Files:**
- Create: `src/lib/schema/author.ts`, `work.ts`, `topic.ts`, `quote.ts`, `index.ts`
- Test: `src/lib/schema/schema.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/schema/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { AuthorSchema, WorkSchema, TopicSchema, QuoteSchema } from './index';

describe('AuthorSchema', () => {
	it('accepts a minimal author', () => {
		const ok = AuthorSchema.safeParse({
			id: 1, slug: 'augustinus', name: 'Augustin', era: 'post-nicene',
			language: ['latin'], sources: {}
		});
		expect(ok.success).toBe(true);
	});
	it('rejects unknown era', () => {
		const bad = AuthorSchema.safeParse({
			id: 1, slug: 'x', name: 'X', era: 'unknown', language: ['latin'], sources: {}
		});
		expect(bad.success).toBe(false);
	});
});

describe('WorkSchema', () => {
	it('requires authorId', () => {
		expect(WorkSchema.safeParse({ id: 1, slug: 'a', title: 'A' }).success).toBe(false);
		expect(WorkSchema.safeParse({ id: 1, slug: 'a', title: 'A', authorId: 1 }).success).toBe(true);
	});
});

describe('TopicSchema', () => {
	it('accepts roman section', () => {
		expect(TopicSchema.safeParse({
			id: 1, slug: 'foi', label: 'Foi', section: 'I', groupe: 'Sources'
		}).success).toBe(true);
	});
	it('rejects non-roman section', () => {
		expect(TopicSchema.safeParse({
			id: 1, slug: 'foi', label: 'Foi', section: '9', groupe: 'X'
		}).success).toBe(false);
	});
});

describe('QuoteSchema', () => {
	it('accepts minimal quote', () => {
		const ok = QuoteSchema.safeParse({
			id: 1, slug: 'q-1', authorId: 1, topicIds: [1], fr: 'Bonjour', links: {}
		});
		expect(ok.success).toBe(true);
	});
	it('requires at least one topicId', () => {
		const bad = QuoteSchema.safeParse({
			id: 1, slug: 'q-1', authorId: 1, topicIds: [], links: {}
		});
		expect(bad.success).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit -- src/lib/schema/schema.test.ts
```
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement schemas**

`src/lib/schema/author.ts`:
```ts
import { z } from 'zod';

export const EraSchema = z.enum(['apostolic', 'ante-nicene', 'nicene', 'post-nicene', 'medieval']);
export type Era = z.infer<typeof EraSchema>;

export const AuthorSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	name: z.string().min(1),
	originalName: z.string().optional(),
	era: EraSchema,
	dates: z.string().optional(),
	feastDay: z.string().optional(),
	function: z.string().optional(),
	language: z.array(z.string()).default([]),
	region: z.string().optional(),
	groups: z.array(z.string()).optional(),
	disciples: z.array(z.number().int()).optional(),
	sources: z.object({
		wikipedia: z.string().url().optional(),
		wikisource: z.string().url().optional(),
		wikimedia: z.string().url().optional()
	}).default({}),
	status: z.string().optional(),
	bioShort: z.string().optional(),
	bioLong: z.string().optional()
});
export type Author = z.infer<typeof AuthorSchema>;
```

`src/lib/schema/work.ts`:
```ts
import { z } from 'zod';
export const WorkSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	title: z.string().min(1),
	alternativeTitles: z.array(z.string()).optional(),
	authorId: z.number().int().nonnegative(),
	description: z.string().optional(),
	link: z.string().url().optional(),
	summary: z.string().optional(),
	compositionDate: z.string().optional(),
	outline: z.string().optional(),
	editions: z.array(z.string()).optional()
});
export type Work = z.infer<typeof WorkSchema>;
```

`src/lib/schema/topic.ts`:
```ts
import { z } from 'zod';
export const SectionSchema = z.enum(['I','II','III','IV','V','VI','VII','VIII']);
export type Section = z.infer<typeof SectionSchema>;

export const TopicSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	label: z.string().min(1),
	section: SectionSchema,
	groupe: z.string().min(1),
	description: z.string().optional()
});
export type Topic = z.infer<typeof TopicSchema>;
```

`src/lib/schema/quote.ts`:
```ts
import { z } from 'zod';
export const QuoteStatusSchema = z.enum(['draft', 'ok']);
export const QuoteSchema = z.object({
	id: z.number().int().nonnegative(),
	slug: z.string().min(1),
	title: z.string().optional(),
	authorId: z.number().int().nonnegative(),
	workId: z.number().int().nonnegative().optional(),
	topicIds: z.array(z.number().int().nonnegative()).min(1),
	reference: z.string().optional(),
	fr: z.string().optional(),
	en: z.string().optional(),
	latin: z.string().optional(),
	greek: z.string().optional(),
	context: z.string().optional(),
	migne: z.string().optional(),
	links: z.object({
		primary: z.string().url().optional(),
		archive: z.string().url().optional()
	}).default({}),
	notes: z.string().optional(),
	status: QuoteStatusSchema.optional()
});
export type Quote = z.infer<typeof QuoteSchema>;
```

`src/lib/schema/index.ts`:
```ts
export * from './author';
export * from './work';
export * from './topic';
export * from './quote';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:unit -- src/lib/schema/schema.test.ts
```
Expected: PASS (4 tests, 8 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema
git commit -m "feat: zod schemas for Author/Work/Topic/Quote"
```

---

### Task 7: xlsx → JSON import script

**Files:**
- Create: `scripts/import-xlsx.ts`
- Test: `scripts/import-xlsx.test.ts`

The xlsx layout (verified by inspection):
- `Auteurs` sheet, header row 2: `ID, Name, Ère, Page WikiSource, Page Wikipedia, Nom d'origine, Date, Fêté le, Fonction, Langue, Groupes d'auteurs, Page WikiMedia, Disciple de, Région moderne, Status, Œuvres`. Column index 0 is empty padding; ID starts at column index 1.
- `Sujets` sheet, header row 2: `ID, Topic, Section, Groupe, Description`.
- `Œuvres` sheet, header row 2: `ID, Titre, Auteur ou Source, Titres Alternatifs, ID2, Description, Lien`.
- `Citations` sheet, header row 2: `OK?, ID, Auteur, Source, Sujet, Citation Anglais, Citation Latin Complète, Citation Grec/Syriaque complète, Context, Lien, Lien Archive, Migne Ref, Référence, Citation Français, Citation Anglais traduite, Notes, Cit. Abrégée, Autre source`.

- [ ] **Step 1: Write the script**

`scripts/import-xlsx.ts`:
```ts
import * as XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	AuthorSchema, WorkSchema, TopicSchema, QuoteSchema,
	type Author, type Work, type Topic, type Quote, type Era
} from '../src/lib/schema';

const XLSX_PATH = process.env.XLSX_PATH
	?? '/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/fathers/excel/fathers_db.xlsx';
const OUT_DIR = join(process.cwd(), 'src/lib/data');

function slugify(s: string): string {
	return s.toLowerCase()
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}

function eraFromFr(raw: unknown): Era {
	const s = String(raw ?? '').toLowerCase();
	if (s.includes('apostol')) return 'apostolic';
	if (s.includes('ante') || s.includes('avant')) return 'ante-nicene';
	if (s.includes('nicen') || s.includes('nicée')) return 'nicene';
	if (s.includes('post')) return 'post-nicene';
	if (s.includes('méd') || s.includes('moyen')) return 'medieval';
	return 'post-nicene'; // sensible default; corrected in /admin if wrong
}

function readSheet(wb: XLSX.WorkBook, name: string): unknown[][] {
	const ws = wb.Sheets[name];
	if (!ws) throw new Error(`Sheet not found: ${name}`);
	return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
}

function splitList(s: unknown): string[] {
	if (!s) return [];
	return String(s).split(/[;,]\s*/).map(x => x.trim()).filter(Boolean);
}

function splitIds(s: unknown): number[] {
	return splitList(s).map(Number).filter(n => Number.isFinite(n));
}

function importAuthors(wb: XLSX.WorkBook): Author[] {
	const rows = readSheet(wb, 'Auteurs').slice(2); // headers on rows 1-2
	const out: Author[] = [];
	for (const r of rows) {
		const id = Number(r[1]); if (!Number.isFinite(id)) continue;
		const name = String(r[2] ?? '').trim(); if (!name) continue;
		const author: Author = {
			id, slug: slugify(name + '-' + id), name,
			originalName: r[6] ? String(r[6]) : undefined,
			era: eraFromFr(r[3]),
			dates: r[7] ? String(r[7]) : undefined,
			feastDay: r[8] ? String(r[8]) : undefined,
			function: r[9] ? String(r[9]) : undefined,
			language: splitList(r[10]),
			region: r[14] ? String(r[14]) : undefined,
			groups: splitList(r[11]),
			disciples: splitIds(r[13]),
			sources: {
				wikipedia: r[5] ? String(r[5]) : undefined,
				wikisource: r[4] ? String(r[4]) : undefined,
				wikimedia: r[12] ? String(r[12]) : undefined
			},
			status: r[15] ? String(r[15]) : undefined
		};
		const parsed = AuthorSchema.safeParse(author);
		if (!parsed.success) { console.warn('skip author', id, parsed.error.issues); continue; }
		out.push(parsed.data);
	}
	return out;
}

function importTopics(wb: XLSX.WorkBook): Topic[] {
	const rows = readSheet(wb, 'Sujets').slice(2);
	const out: Topic[] = [];
	for (const r of rows) {
		const id = Number(r[1]); if (!Number.isFinite(id)) continue;
		const label = String(r[2] ?? '').trim(); if (!label) continue;
		const section = String(r[3] ?? '').trim();
		const topic: Topic = {
			id, slug: slugify(label + '-' + id), label,
			section: section as Topic['section'],
			groupe: String(r[4] ?? '').trim(),
			description: r[5] ? String(r[5]) : undefined
		};
		const parsed = TopicSchema.safeParse(topic);
		if (!parsed.success) { console.warn('skip topic', id, parsed.error.issues); continue; }
		out.push(parsed.data);
	}
	return out;
}

function importWorks(wb: XLSX.WorkBook, authorByName: Map<string, number>): Work[] {
	const rows = readSheet(wb, 'Œuvres').slice(2);
	const out: Work[] = [];
	for (const r of rows) {
		const id = Number(r[1]); if (!Number.isFinite(id)) continue;
		const title = String(r[2] ?? '').trim(); if (!title) continue;
		const authorName = String(r[3] ?? '').trim();
		const authorId = authorByName.get(authorName) ?? -1;
		if (authorId < 0) { console.warn('work', id, 'unknown author', authorName); continue; }
		const work: Work = {
			id, slug: slugify(title + '-' + id), title,
			alternativeTitles: splitList(r[4]),
			authorId,
			description: r[6] ? String(r[6]) : undefined,
			link: r[7] && /^https?:\/\//.test(String(r[7])) ? String(r[7]) : undefined
		};
		const parsed = WorkSchema.safeParse(work);
		if (!parsed.success) { console.warn('skip work', id, parsed.error.issues); continue; }
		out.push(parsed.data);
	}
	return out;
}

function importQuotes(
	wb: XLSX.WorkBook,
	authorByName: Map<string, number>,
	workByTitle: Map<string, number>,
	topicByLabel: Map<string, number>
): Quote[] {
	const rows = readSheet(wb, 'Citations').slice(2);
	const out: Quote[] = [];
	for (const r of rows) {
		const id = Number(r[2]); if (!Number.isFinite(id)) continue;
		const authorName = String(r[3] ?? '').trim();
		const authorId = authorByName.get(authorName);
		if (authorId == null) { console.warn('quote', id, 'unknown author', authorName); continue; }
		const workTitle = String(r[4] ?? '').trim();
		const workId = workTitle ? workByTitle.get(workTitle) : undefined;
		const topicIds = String(r[5] ?? '')
			.split(/[;,]\s*/).map(s => s.trim()).filter(Boolean)
			.map(label => topicByLabel.get(label))
			.filter((n): n is number => typeof n === 'number');
		if (topicIds.length === 0) { console.warn('quote', id, 'no topics matched'); continue; }
		const linksPrimary = r[10] && /^https?:\/\//.test(String(r[10])) ? String(r[10]) : undefined;
		const linksArchive = r[11] && /^https?:\/\//.test(String(r[11])) ? String(r[11]) : undefined;
		const quote: Quote = {
			id, slug: `citation-${id}`,
			authorId, workId, topicIds,
			reference: r[13] ? String(r[13]) : undefined,
			fr: r[14] ? String(r[14]) : undefined,
			en: r[6] ? String(r[6]) : undefined,
			latin: r[7] ? String(r[7]) : undefined,
			greek: r[8] ? String(r[8]) : undefined,
			context: r[9] ? String(r[9]) : undefined,
			migne: r[12] ? String(r[12]) : undefined,
			links: { primary: linksPrimary, archive: linksArchive },
			notes: r[16] ? String(r[16]) : undefined,
			status: String(r[1] ?? '').toLowerCase().includes('ok') ? 'ok' : 'draft'
		};
		const parsed = QuoteSchema.safeParse(quote);
		if (!parsed.success) { console.warn('skip quote', id, parsed.error.issues); continue; }
		out.push(parsed.data);
	}
	return out;
}

function write(path: string, data: unknown) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
	console.log('wrote', path, '(' + (Array.isArray(data) ? data.length : '?') + ' records)');
}

async function main() {
	const wb = XLSX.readFile(XLSX_PATH);
	const authors = importAuthors(wb);
	const topics = importTopics(wb);
	const authorByName = new Map(authors.map(a => [a.name, a.id]));
	const works = importWorks(wb, authorByName);
	const workByTitle = new Map(works.map(w => [w.title, w.id]));
	const topicByLabel = new Map(topics.map(t => [t.label, t.id]));
	const quotes = importQuotes(wb, authorByName, workByTitle, topicByLabel);

	write(join(OUT_DIR, 'authors.json'), authors);
	write(join(OUT_DIR, 'topics.json'), topics);
	write(join(OUT_DIR, 'works.json'), works);
	write(join(OUT_DIR, 'quotes.json'), quotes);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the import**

```bash
npm run import-xlsx
```
Expected: warnings for any unmatched authors/topics, plus four `wrote …` lines.

- [ ] **Step 3: Sanity check the output**

```bash
node -e "const x=require('./src/lib/data/authors.json');console.log('authors:',x.length);console.log(JSON.stringify(x[0],null,2))"
node -e "const x=require('./src/lib/data/topics.json');console.log('topics:',x.length)"
node -e "const x=require('./src/lib/data/works.json');console.log('works:',x.length)"
node -e "const x=require('./src/lib/data/quotes.json');console.log('quotes:',x.length)"
```
Expected: authors ≈ 76, topics = 49, works ≈ 320, quotes ≈ 700-800.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-xlsx.ts src/lib/data/
git commit -m "feat: xlsx importer + initial JSON dataset"
```

---

### Task 8: Data loader module

**Files:**
- Create: `src/lib/data/index.ts`
- Test: `src/lib/data/index.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/data/index.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { authors, works, topics, quotes, authorById, workById, topicById, quoteById } from './index';

describe('data loader', () => {
	it('loads all four collections as non-empty arrays', () => {
		expect(authors.length).toBeGreaterThan(0);
		expect(topics.length).toBe(49);
		expect(works.length).toBeGreaterThan(0);
		expect(quotes.length).toBeGreaterThan(0);
	});

	it('exposes lookup-by-id helpers', () => {
		expect(authorById(authors[0].id)).toBe(authors[0]);
		expect(authorById(-1)).toBeUndefined();
	});

	it('every quote.authorId points to an existing author', () => {
		const ids = new Set(authors.map(a => a.id));
		const orphans = quotes.filter(q => !ids.has(q.authorId));
		expect(orphans).toEqual([]);
	});

	it('every quote.topicIds member points to an existing topic', () => {
		const ids = new Set(topics.map(t => t.id));
		const bad = quotes.flatMap(q => q.topicIds.filter(t => !ids.has(t)));
		expect(bad).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:unit -- src/lib/data/index.test.ts
```
Expected: FAIL ("Cannot find module './index'").

- [ ] **Step 3: Implement the loader**

`src/lib/data/index.ts`:
```ts
import { z } from 'zod';
import { AuthorSchema, WorkSchema, TopicSchema, QuoteSchema, type Author, type Work, type Topic, type Quote } from '$lib/schema';
import authorsRaw from './authors.json';
import worksRaw from './works.json';
import topicsRaw from './topics.json';
import quotesRaw from './quotes.json';

function parseAll<T>(name: string, schema: z.ZodType<T>, raw: unknown): T[] {
	const arr = z.array(schema).safeParse(raw);
	if (!arr.success) throw new Error(`Invalid ${name}: ${JSON.stringify(arr.error.issues, null, 2)}`);
	return arr.data;
}

export const authors: Author[] = parseAll('authors', AuthorSchema, authorsRaw);
export const works: Work[] = parseAll('works', WorkSchema, worksRaw);
export const topics: Topic[] = parseAll('topics', TopicSchema, topicsRaw);
export const quotes: Quote[] = parseAll('quotes', QuoteSchema, quotesRaw);

const authorMap = new Map(authors.map(a => [a.id, a]));
const workMap = new Map(works.map(w => [w.id, w]));
const topicMap = new Map(topics.map(t => [t.id, t]));
const quoteMap = new Map(quotes.map(q => [q.id, q]));

export const authorById = (id: number) => authorMap.get(id);
export const workById = (id: number) => workMap.get(id);
export const topicById = (id: number) => topicMap.get(id);
export const quoteById = (id: number) => quoteMap.get(id);

export const authorBySlug = (slug: string) => authors.find(a => a.slug === slug);
export const workBySlug = (slug: string) => works.find(w => w.slug === slug);
export const topicBySlug = (slug: string) => topics.find(t => t.slug === slug);
export const quoteBySlug = (slug: string) => quotes.find(q => q.slug === slug);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:unit -- src/lib/data/index.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/index.ts src/lib/data/index.test.ts
git commit -m "feat: data loader with FK integrity checks"
```

---

## Phase C — Helpers

### Task 9: Slug helper

**Files:** Create `src/lib/utils/slug.ts`, `src/lib/utils/slug.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
	it('lowercases and dashes', () => expect(slugify('Hello World')).toBe('hello-world'));
	it('strips accents', () => expect(slugify('Évangile')).toBe('evangile'));
	it('strips punctuation', () => expect(slugify("L'Église")).toBe('l-eglise'));
	it('truncates at 80 chars', () => expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80));
	it('returns the input as-is when already a slug', () => expect(slugify('abc-123')).toBe('abc-123'));
});
```

- [ ] **Step 2: Run, expect FAIL.**

```bash
npm run test:unit -- src/lib/utils/slug.test.ts
```

- [ ] **Step 3: Implement**

```ts
export function slugify(s: string): string {
	return s.toLowerCase()
		.normalize('NFD').replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/slug.ts src/lib/utils/slug.test.ts
git commit -m "feat: slugify helper"
```

---

### Task 10: Era helper

**Files:** Create `src/lib/utils/era.ts`, `src/lib/utils/era.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { eraLabel, eraMidpoint, eraOrder } from './era';

describe('era', () => {
	it('returns French labels', () => {
		expect(eraLabel('apostolic')).toBe('Pères apostoliques');
		expect(eraLabel('ante-nicene')).toBe('Pré-nicéens');
		expect(eraLabel('nicene')).toBe('Nicéens');
		expect(eraLabel('post-nicene')).toBe('Post-nicéens');
		expect(eraLabel('medieval')).toBe('Médiévaux');
	});
	it('returns a numeric midpoint per era', () => {
		expect(eraMidpoint('apostolic')).toBeLessThan(eraMidpoint('ante-nicene'));
		expect(eraMidpoint('ante-nicene')).toBeLessThan(eraMidpoint('nicene'));
		expect(eraMidpoint('nicene')).toBeLessThan(eraMidpoint('post-nicene'));
		expect(eraMidpoint('post-nicene')).toBeLessThan(eraMidpoint('medieval'));
	});
	it('orders the eras chronologically', () => {
		expect(eraOrder).toEqual(['apostolic','ante-nicene','nicene','post-nicene','medieval']);
	});
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { Era } from '$lib/schema';

export const eraOrder: Era[] = ['apostolic','ante-nicene','nicene','post-nicene','medieval'];

const LABEL: Record<Era, string> = {
	apostolic: 'Pères apostoliques',
	'ante-nicene': 'Pré-nicéens',
	nicene: 'Nicéens',
	'post-nicene': 'Post-nicéens',
	medieval: 'Médiévaux'
};
export function eraLabel(e: Era): string { return LABEL[e]; }

const MID: Record<Era, number> = {
	apostolic: 75, 'ante-nicene': 225, nicene: 350, 'post-nicene': 500, medieval: 1100
};
export function eraMidpoint(e: Era): number { return MID[e]; }
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/era.ts src/lib/utils/era.test.ts
git commit -m "feat: era labels, ordering, midpoints"
```

---

### Task 11: Quote effective-date helper

**Files:** Create `src/lib/utils/quote-date.ts`, `src/lib/utils/quote-date.test.ts`.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { quoteEffectiveYear } from './quote-date';
import type { Author } from '$lib/schema';

const ag = { id: 1, slug:'a', name:'A', era:'post-nicene', language:[], sources:{}, dates:'c. 354 - 430' } as Author;
const orig = { id: 2, slug:'o', name:'O', era:'ante-nicene', language:[], sources:{}, dates:'c. 185-c. 254' } as Author;
const dateless = { id: 3, slug:'x', name:'X', era:'medieval', language:[], sources:{} } as Author;

describe('quoteEffectiveYear', () => {
	it('extracts the first century-ish year from dates', () => {
		expect(quoteEffectiveYear(ag)).toBe(354);
		expect(quoteEffectiveYear(orig)).toBe(185);
	});
	it('falls back to era midpoint when dates missing', () => {
		expect(quoteEffectiveYear(dateless)).toBe(1100);
	});
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { Author } from '$lib/schema';
import { eraMidpoint } from './era';

export function quoteEffectiveYear(author: Author): number {
	if (author.dates) {
		const m = author.dates.match(/\d{2,4}/);
		if (m) return Number(m[0]);
	}
	return eraMidpoint(author.era);
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/quote-date.ts src/lib/utils/quote-date.test.ts
git commit -m "feat: quote effective-year helper"
```

---

### Task 12: Quote title derivation helper

**Files:** Create `src/lib/utils/derive-quote-title.ts`, test.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { deriveQuoteTitle } from './derive-quote-title';
import type { Quote, Topic } from '$lib/schema';

const baseQ = (overrides: Partial<Quote>): Quote => ({
	id: 1, slug:'q-1', authorId:1, topicIds:[10], links:{}, ...overrides
});
const topics: Topic[] = [{ id:10, slug:'foi', label:'La foi', section:'I', groupe:'Sources' }];

describe('deriveQuoteTitle', () => {
	it('returns the explicit title when present', () => {
		expect(deriveQuoteTitle(baseQ({ title:'Sur la foi' }), topics)).toBe('Sur la foi');
	});
	it('falls back to first sentence of fr, truncated', () => {
		const fr = 'La foi est la substance des choses espérées. Elle est aussi…';
		expect(deriveQuoteTitle(baseQ({ fr }), topics)).toBe('La foi est la substance des choses espérées');
	});
	it('truncates a single long sentence with an ellipsis', () => {
		const long = 'a'.repeat(120);
		const title = deriveQuoteTitle(baseQ({ fr: long }), topics);
		expect(title.length).toBeLessThanOrEqual(81);
		expect(title.endsWith('…')).toBe(true);
	});
	it('falls back to the primary topic label when fr is missing', () => {
		expect(deriveQuoteTitle(baseQ({}), topics)).toBe('La foi');
	});
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { Quote, Topic } from '$lib/schema';

const MAX = 80;

export function deriveQuoteTitle(q: Quote, topics: Topic[]): string {
	if (q.title?.trim()) return q.title.trim();
	if (q.fr?.trim()) {
		const text = q.fr.trim();
		const firstSentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
		const clean = firstSentence.replace(/[.!?]+$/, '');
		if (clean.length <= MAX) return clean;
		return clean.slice(0, MAX).replace(/\s+\S*$/, '') + '…';
	}
	const t = topics.find(t => t.id === q.topicIds[0]);
	return t?.label ?? '';
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/derive-quote-title.ts src/lib/utils/derive-quote-title.test.ts
git commit -m "feat: derive-quote-title helper (v1 fallback)"
```

---

### Task 13: Citation formatter

**Files:** Create `src/lib/utils/format-citation.ts`, test.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { formatCitation } from './format-citation';
import type { Author, Work, Quote } from '$lib/schema';

const augustinus = { id:1, slug:'a', name:'Augustin', originalName:'Augustinus', era:'post-nicene', language:['latin'], sources:{} } as Author;
const civDei = { id:1, slug:'w', title:'La Cité de Dieu', authorId:1, alternativeTitles:['De civitate Dei'] } as Work;
const quote = { id:99, slug:'q', authorId:1, workId:1, topicIds:[1], reference:'XIV.28', migne:'PL 41:436', links:{} } as Quote;

describe('formatCitation', () => {
	it('produces academic format with PL ref', () => {
		expect(formatCitation(quote, augustinus, civDei))
			.toBe('Augustinus, De civitate Dei XIV.28 (PL 41:436).');
	});
	it('omits Migne segment when absent', () => {
		expect(formatCitation({ ...quote, migne: undefined }, augustinus, civDei))
			.toBe('Augustinus, De civitate Dei XIV.28.');
	});
	it('falls back to FR title if no Latin original title', () => {
		expect(formatCitation(quote, augustinus, { ...civDei, alternativeTitles: [] }))
			.toBe('Augustinus, La Cité de Dieu XIV.28 (PL 41:436).');
	});
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { Author, Work, Quote } from '$lib/schema';

function pickWorkTitle(w: Work | undefined): string {
	if (!w) return '';
	const latin = w.alternativeTitles?.find(t => /^[A-Z][a-zæœ ,.'\-]+$/.test(t.split(' ')[0] ?? ''));
	return latin ?? w.title;
}

function pickAuthorName(a: Author): string {
	return a.originalName ?? a.name;
}

export function formatCitation(q: Quote, a: Author, w?: Work): string {
	const parts = [pickAuthorName(a)];
	const work = pickWorkTitle(w);
	const ref = q.reference?.trim();
	if (work && ref) parts.push(`${work} ${ref}`);
	else if (work) parts.push(work);
	else if (ref) parts.push(ref);
	const main = parts.join(', ');
	return q.migne ? `${main} (${q.migne}).` : `${main}.`;
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/format-citation.ts src/lib/utils/format-citation.test.ts
git commit -m "feat: academic citation formatter"
```

---

### Task 14: Filter + sort reducer

**Files:** Create `src/lib/utils/filters.ts`, test.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { applyFiltersAndSort, type QuoteFilters, type QuoteSort } from './filters';
import type { Author, Quote } from '$lib/schema';

const A: Author[] = [
	{ id:1, slug:'a', name:'Apo', era:'apostolic', language:['grec'], region:'Asie Mineure', sources:{} },
	{ id:2, slug:'b', name:'Aug', era:'post-nicene', language:['latin'], region:'Afrique', sources:{}, dates:'354-430' }
];
const Q: Quote[] = [
	{ id:1, slug:'q1', authorId:1, topicIds:[1], links:{}, fr:'A' },
	{ id:2, slug:'q2', authorId:2, topicIds:[1], links:{}, fr:'B' }
];

describe('applyFiltersAndSort', () => {
	it('filters by era', () => {
		const r = applyFiltersAndSort(Q, A, { ere:['apostolic'] }, 'date-asc');
		expect(r.map(q => q.id)).toEqual([1]);
	});
	it('filters by region', () => {
		const r = applyFiltersAndSort(Q, A, { region:['Afrique'] }, 'date-asc');
		expect(r.map(q => q.id)).toEqual([2]);
	});
	it('filters by language', () => {
		expect(applyFiltersAndSort(Q, A, { langue:['latin'] }, 'date-asc').map(q=>q.id)).toEqual([2]);
	});
	it('sorts by date ascending', () => {
		expect(applyFiltersAndSort(Q, A, {}, 'date-asc').map(q=>q.id)).toEqual([1, 2]);
	});
	it('sorts by date descending', () => {
		expect(applyFiltersAndSort(Q, A, {}, 'date-desc').map(q=>q.id)).toEqual([2, 1]);
	});
	it('sorts by author name', () => {
		expect(applyFiltersAndSort(Q, A, {}, 'author').map(q=>q.id)).toEqual([1, 2]);
	});
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
import type { Author, Quote, Era, Work } from '$lib/schema';
import { quoteEffectiveYear } from './quote-date';

export interface QuoteFilters {
	ere?: Era[];
	region?: string[];
	langue?: string[];
	pere?: number[]; // authorId
}
export type QuoteSort = 'date-asc' | 'date-desc' | 'author' | 'work' | 'canonical';

export function applyFiltersAndSort(
	quotes: Quote[],
	authors: Author[],
	f: QuoteFilters,
	sort: QuoteSort,
	works: Work[] = []
): Quote[] {
	const byAuthor = new Map(authors.map(a => [a.id, a]));
	const byWork = new Map(works.map(w => [w.id, w]));

	const filtered = quotes.filter(q => {
		const a = byAuthor.get(q.authorId);
		if (!a) return false;
		if (f.ere?.length && !f.ere.includes(a.era)) return false;
		if (f.region?.length && (!a.region || !f.region.includes(a.region))) return false;
		if (f.langue?.length && !a.language.some(l => f.langue!.includes(l))) return false;
		if (f.pere?.length && !f.pere.includes(a.id)) return false;
		return true;
	});

	const sorted = filtered.slice();
	if (sort === 'canonical') return sorted;
	sorted.sort((p, q) => {
		const ap = byAuthor.get(p.authorId)!;
		const aq = byAuthor.get(q.authorId)!;
		if (sort === 'date-asc') return quoteEffectiveYear(ap) - quoteEffectiveYear(aq);
		if (sort === 'date-desc') return quoteEffectiveYear(aq) - quoteEffectiveYear(ap);
		if (sort === 'author') return ap.name.localeCompare(aq.name, 'fr');
		if (sort === 'work') {
			const wp = p.workId ? byWork.get(p.workId)?.title ?? '' : '';
			const wq = q.workId ? byWork.get(q.workId)?.title ?? '' : '';
			return wp.localeCompare(wq, 'fr');
		}
		return 0;
	});
	return sorted;
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/filters.ts src/lib/utils/filters.test.ts
git commit -m "feat: quote filters + sort reducer"
```

---

## Phase D — Prebuild pipeline

### Task 15: Prebuild script — validation + search index + gaps report

**Files:** Create `scripts/prebuild.ts`. Also creates `static/data/search-index.json` at runtime.

- [ ] **Step 1: Implement**

`scripts/prebuild.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import MiniSearch from 'minisearch';
import {
	AuthorSchema, WorkSchema, TopicSchema, QuoteSchema,
	type Author, type Work, type Topic, type Quote
} from '../src/lib/schema';

const DATA = join(process.cwd(), 'src/lib/data');
const OUT = join(process.cwd(), 'static/data');

function loadArray<T>(name: string, schema: any): T[] {
	const path = join(DATA, name);
	if (!existsSync(path)) { console.error('Missing data file:', path); process.exit(1); }
	const raw = JSON.parse(readFileSync(path, 'utf-8'));
	const parsed = schema.array().safeParse(raw);
	if (!parsed.success) {
		console.error(`Validation failed for ${name}:\n${JSON.stringify(parsed.error.issues, null, 2)}`);
		process.exit(1);
	}
	return parsed.data;
}

function buildIndex(authors: Author[], works: Work[], topics: Topic[], quotes: Quote[]) {
	const docs = [
		...quotes.map(q => ({
			id: `quote-${q.id}`, type: 'quote',
			title: q.title ?? '',
			body: [q.fr, q.en, q.latin, q.greek, q.context, q.notes].filter(Boolean).join(' '),
			slug: q.slug
		})),
		...authors.map(a => ({
			id: `author-${a.id}`, type: 'author',
			title: a.name, body: [a.originalName, a.bioShort, a.region].filter(Boolean).join(' '),
			slug: a.slug
		})),
		...works.map(w => ({
			id: `work-${w.id}`, type: 'work',
			title: w.title, body: [w.description, (w.alternativeTitles ?? []).join(' ')].join(' '),
			slug: w.slug
		})),
		...topics.map(t => ({
			id: `topic-${t.id}`, type: 'topic',
			title: t.label, body: t.description ?? '',
			slug: t.slug
		}))
	];
	const ms = new MiniSearch({
		fields: ['title', 'body'],
		storeFields: ['type', 'title', 'slug']
	});
	ms.addAll(docs);
	mkdirSync(OUT, { recursive: true });
	writeFileSync(join(OUT, 'search-index.json'), JSON.stringify(ms.toJSON()), 'utf-8');
	console.log('search index: wrote', docs.length, 'documents');
}

function gapsReport(authors: Author[], works: Work[], quotes: Quote[]) {
	const authorIds = new Set(authors.map(a => a.id));
	const workIds = new Set(works.map(w => w.id));

	const noFr = quotes.filter(q => !q.fr?.trim()).length;
	const noOriginal = quotes.filter(q => !q.latin && !q.greek).length;
	const brokenAuthor = quotes.filter(q => !authorIds.has(q.authorId)).length;
	const brokenWork = quotes.filter(q => q.workId != null && !workIds.has(q.workId)).length;
	const noTitle = quotes.filter(q => !q.title?.trim()).length;
	const noBio = authors.filter(a => !a.bioShort?.trim()).length;
	const noWorkDescription = works.filter(w => !w.description?.trim()).length;
	const noArchive = quotes.filter(q => !q.links.archive).length;

	console.log('\n=== Gaps report ===');
	console.log(`quotes without FR translation:   ${noFr}`);
	console.log(`quotes without any original:     ${noOriginal}`);
	console.log(`quotes with bespoke title empty: ${noTitle}`);
	console.log(`quotes with broken author FK:    ${brokenAuthor}`);
	console.log(`quotes with broken work FK:      ${brokenWork}`);
	console.log(`quotes without Archive.org link: ${noArchive}`);
	console.log(`authors missing bioShort:        ${noBio}`);
	console.log(`works missing description:       ${noWorkDescription}`);
	console.log('===================\n');
}

function main() {
	const authors = loadArray<Author>('authors.json', AuthorSchema);
	const works = loadArray<Work>('works.json', WorkSchema);
	const topics = loadArray<Topic>('topics.json', TopicSchema);
	const quotes = loadArray<Quote>('quotes.json', QuoteSchema);

	console.log(`Validated: ${authors.length} authors, ${works.length} works, ${topics.length} topics, ${quotes.length} quotes`);
	buildIndex(authors, works, topics, quotes);
	gapsReport(authors, works, quotes);
}

main();
```

- [ ] **Step 2: Run it**

```bash
npm run prebuild
```
Expected: `Validated: …` line, then `search index: wrote N documents`, then the gaps report.

- [ ] **Step 3: Verify build succeeds end-to-end**

```bash
npm run build
```
Expected: vite produces a successful Cloudflare build.

- [ ] **Step 4: Commit**

```bash
git add scripts/prebuild.ts
git commit -m "feat: prebuild — schema validation, minisearch index, gaps report"
```

---

## Phase E — Sidebar nav

### Task 16: Sidebar store

**Files:** Create `src/lib/stores/sidebar.svelte.ts`, test.

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('sidebar store', () => {
	beforeEach(() => {
		const storage: Record<string, string> = {};
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => storage[k] ?? null,
			setItem: (k: string, v: string) => { storage[k] = v; },
			removeItem: (k: string) => { delete storage[k]; }
		});
	});
	it('defaults to open', async () => {
		const { sidebar } = await import('./sidebar.svelte');
		expect(sidebar.open).toBe(true);
	});
	it('toggle flips and persists', async () => {
		const { sidebar, toggleSidebar } = await import('./sidebar.svelte');
		toggleSidebar();
		expect(sidebar.open).toBe(false);
		expect(localStorage.getItem('sidebar.open')).toBe('false');
	});
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
function load(): boolean {
	if (typeof localStorage === 'undefined') return true;
	return localStorage.getItem('sidebar.open') !== 'false';
}

export const sidebar = $state({ open: load(), filter: '' });

export function toggleSidebar() {
	sidebar.open = !sidebar.open;
	if (typeof localStorage !== 'undefined') localStorage.setItem('sidebar.open', String(sidebar.open));
}
```

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/sidebar.svelte.ts src/lib/stores/sidebar.test.ts
git commit -m "feat: sidebar store with localStorage persistence"
```

---

### Task 17: Sidebar component family + integrate into layout

**Files:**
- Create: `src/lib/components/ui/Sidebar.svelte`, `SidebarItem.svelte`, `SidebarToggle.svelte`
- Modify: `src/routes/+layout.svelte`
- E2E test: `e2e/sidebar.spec.ts`

- [ ] **Step 1: Read the reference implementations**

Open and study these files:
- `/Users/Janvier/Documents/catechismecatholique/src/lib/components/ui/Sidebar.svelte` (1575 lines)
- `/Users/Janvier/Documents/catechismecatholique/src/lib/components/ui/SidebarItem.svelte` (255 lines)
- `/Users/Janvier/Documents/catechismecatholique/src/lib/components/ui/SidebarToggle.svelte` (28 lines)

The CCC Sidebar takes a corpus-aware tree from `CORPORA`. Here, the tree is the 8 Sections each containing their Sujets.

- [ ] **Step 2: Adapt — write the tree builder**

Add to `src/lib/data/index.ts`:

```ts
import type { Section } from '$lib/schema';

export interface TopicTreeNode {
	section: Section;
	groupe: string;
	href: string;             // /sujets#section-I
	topics: { id: number; slug: string; label: string; href: string; count: number }[];
}

export function buildTopicTree(): TopicTreeNode[] {
	const counts = new Map<number, number>();
	for (const q of quotes) for (const t of q.topicIds) counts.set(t, (counts.get(t) ?? 0) + 1);
	const sections: Section[] = ['I','II','III','IV','V','VI','VII','VIII'];
	return sections.map(section => {
		const topicsInSection = topics.filter(t => t.section === section);
		const groupe = topicsInSection[0]?.groupe ?? '';
		return {
			section, groupe,
			href: `/sujets#section-${section}`,
			topics: topicsInSection.map(t => ({
				id: t.id, slug: t.slug, label: t.label,
				href: `/sujets/${t.slug}`,
				count: counts.get(t.id) ?? 0
			}))
		};
	});
}
```

- [ ] **Step 3: Copy and adapt SidebarToggle**

Copy `SidebarToggle.svelte` verbatim from catechismecatholique. It depends on a toggle handler — wire it to `toggleSidebar`.

- [ ] **Step 4: Copy and adapt SidebarItem**

Copy `SidebarItem.svelte` from catechismecatholique. The component takes `href`, `label`, `count?`, `active?`. If the CCC version takes additional CCC-specific props, simplify.

- [ ] **Step 5: Write Sidebar.svelte tailored to topic tree**

`src/lib/components/ui/Sidebar.svelte`:
```svelte
<script lang="ts">
	import { sidebar, toggleSidebar } from '$lib/stores/sidebar.svelte';
	import { buildTopicTree } from '$lib/data';
	import SidebarItem from './SidebarItem.svelte';
	import { page } from '$app/state';

	const tree = buildTopicTree();
	const filtered = $derived.by(() => {
		const f = sidebar.filter.trim().toLowerCase();
		if (!f) return tree;
		return tree.map(s => ({
			...s,
			topics: s.topics.filter(t => t.label.toLowerCase().includes(f))
		})).filter(s => s.topics.length > 0);
	});
	const currentPath = $derived(page.url.pathname);
</script>

<aside
	class="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-border bg-panel font-ui text-sm md:block"
	class:!hidden={!sidebar.open}
	aria-label="Plan des sujets"
>
	<div class="sticky top-0 z-10 border-b border-border bg-panel p-3">
		<input
			type="search"
			placeholder="Filtrer les sujets…"
			bind:value={sidebar.filter}
			class="w-full rounded border border-border bg-background px-2 py-1"
			aria-label="Filtrer les sujets"
		/>
	</div>
	<nav class="p-2">
		{#each filtered as section (section.section)}
			<details open class="mb-2">
				<summary class="cursor-pointer rounded px-2 py-1 font-medium hover:bg-subtle/10">
					<span class="mr-1 text-muted">{section.section}.</span>{section.groupe}
				</summary>
				<ul class="ml-3 mt-1 space-y-1">
					{#each section.topics as t (t.id)}
						<SidebarItem
							href={t.href}
							label={t.label}
							count={t.count}
							active={currentPath === t.href}
						/>
					{/each}
				</ul>
			</details>
		{/each}
	</nav>
</aside>
```

- [ ] **Step 6: Wire into layout**

Update `src/routes/+layout.svelte`:
```svelte
<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/ui/Sidebar.svelte';
	import SidebarToggle from '$lib/components/ui/SidebarToggle.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	let { children } = $props();
</script>

<div class="flex min-h-screen bg-background text-foreground font-body">
	<Sidebar />
	<div class="min-w-0 flex-1">
		<header class="flex items-center justify-between border-b border-border px-6 py-3">
			<div class="flex items-center gap-3">
				<SidebarToggle />
				<a href="/" class="font-heading text-lg">Pères de l'Église</a>
			</div>
			<nav class="flex items-center gap-4 font-ui text-sm">
				<a href="/sujets">Sujets</a>
				<a href="/peres">Pères</a>
				<a href="/oeuvres">Œuvres</a>
				<a href="/recherche">Recherche</a>
				<ThemeToggle />
			</nav>
		</header>
		<main>{@render children()}</main>
	</div>
</div>
```

- [ ] **Step 7: Write e2e test**

`e2e/sidebar.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('sidebar is open by default and lists all 8 sections', async ({ page }) => {
	await page.goto('/');
	const aside = page.locator('aside[aria-label="Plan des sujets"]');
	await expect(aside).toBeVisible();
	for (const s of ['I','II','III','IV','V','VI','VII','VIII']) {
		await expect(aside.locator(`summary:has-text("${s}.")`)).toBeVisible();
	}
});

test('toggle hides the sidebar and persists across reloads', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: /plan|sidebar|sujets/i }).click();
	await expect(page.locator('aside[aria-label="Plan des sujets"]')).toBeHidden();
	await page.reload();
	await expect(page.locator('aside[aria-label="Plan des sujets"]')).toBeHidden();
});

test('filter narrows the topic list', async ({ page }) => {
	await page.goto('/');
	await page.getByPlaceholder('Filtrer les sujets…').fill('foi');
	await expect(page.locator('aside li')).toHaveCount(1, { timeout: 2000 });
});
```

- [ ] **Step 8: Run e2e**

```bash
npm run test:e2e -- e2e/sidebar.spec.ts
```
Expected: all 3 pass.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/index.ts src/lib/components/ui/Sidebar*.svelte src/routes/+layout.svelte e2e/sidebar.spec.ts
git commit -m "feat: persistent collapsible sidebar with topic tree + filter"
```

---

## Phase F — Public routes

### Task 18: Homepage

**Files:**
- Modify: `src/routes/+page.svelte`
- Create: `src/lib/components/peres/SectionTile.svelte`

- [ ] **Step 1: Create SectionTile.svelte**

```svelte
<script lang="ts">
	let { section, groupe, count, href }: { section: string; groupe: string; count: number; href: string } = $props();
</script>
<a {href} class="block rounded-lg border border-border bg-panel p-4 transition hover:border-accent">
	<div class="font-ui text-xs uppercase tracking-widest text-muted">Section {section}</div>
	<div class="mt-1 font-heading text-xl">{groupe}</div>
	<div class="mt-2 text-sm text-muted">{count} sujets</div>
</a>
```

- [ ] **Step 2: Rewrite the homepage**

`src/routes/+page.svelte`:
```svelte
<script lang="ts">
	import { buildTopicTree, authors, quotes } from '$lib/data';
	import SectionTile from '$lib/components/peres/SectionTile.svelte';

	const tree = buildTopicTree();
	const featuredAuthors = authors.slice(0, 6);
	const totalQuotes = quotes.length;
</script>

<section class="border-b border-border px-6 py-12">
	<h1 class="font-heading text-4xl md:text-5xl">Pères de l'Église</h1>
	<p class="mt-3 max-w-reader font-body text-lg text-muted">
		Anthologie patristique française organisée par sujets. {totalQuotes} citations, {authors.length} Pères.
	</p>
	<form action="/recherche" class="mt-6 max-w-reader">
		<input
			type="search"
			name="q"
			placeholder="Chercher dans le corpus…"
			class="w-full rounded border border-border bg-panel px-3 py-2 font-ui"
		/>
	</form>
</section>

<section class="px-6 py-10">
	<h2 class="font-heading text-2xl">Parcourir par section</h2>
	<div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
		{#each tree as s (s.section)}
			<SectionTile
				section={s.section}
				groupe={s.groupe}
				count={s.topics.length}
				href={`/sujets#section-${s.section}`}
			/>
		{/each}
	</div>
</section>

<section class="border-t border-border bg-panel px-6 py-10">
	<h2 class="font-heading text-2xl">Pères en vedette</h2>
	<ul class="mt-4 flex flex-wrap gap-3">
		{#each featuredAuthors as a (a.id)}
			<li>
				<a href={`/peres/${a.slug}`} class="rounded-full border border-border bg-background px-3 py-1 font-ui text-sm hover:border-accent">
					{a.name}
				</a>
			</li>
		{/each}
	</ul>
</section>
```

- [ ] **Step 3: Verify visually**

```bash
npm run dev
```
Open http://localhost:5173. Expected: hero, 8 section tiles, fathers strip.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/lib/components/peres/SectionTile.svelte
git commit -m "feat: homepage with section tiles and featured fathers strip"
```

---

### Task 19: QuoteCard component

**Files:**
- Create: `src/lib/components/peres/QuoteCard.svelte`, `TopicChip.svelte`, `EraBadge.svelte`

- [ ] **Step 1: Create TopicChip**

```svelte
<script lang="ts">
	let { topic }: { topic: { slug: string; label: string } } = $props();
</script>
<a href={`/sujets/${topic.slug}`}
	class="rounded-full border border-border bg-panel px-2 py-0.5 font-ui text-xs text-muted hover:border-accent hover:text-foreground">
	{topic.label}
</a>
```

- [ ] **Step 2: Create EraBadge**

```svelte
<script lang="ts">
	import { eraLabel } from '$lib/utils/era';
	import type { Era } from '$lib/schema';
	let { era }: { era: Era } = $props();
</script>
<span class="rounded border border-border bg-subtle/10 px-1.5 py-0.5 font-ui text-[10px] uppercase tracking-wider text-muted">
	{eraLabel(era)}
</span>
```

- [ ] **Step 3: Create QuoteCard**

`src/lib/components/peres/QuoteCard.svelte`:
```svelte
<script lang="ts">
	import type { Quote } from '$lib/schema';
	import { authorById, workById, topicById } from '$lib/data';
	import { deriveQuoteTitle } from '$lib/utils/derive-quote-title';
	import { formatCitation } from '$lib/utils/format-citation';
	import TopicChip from './TopicChip.svelte';
	import EraBadge from './EraBadge.svelte';

	let { quote, onOpenPanel }: { quote: Quote; onOpenPanel?: (q: Quote) => void } = $props();

	const author = $derived(authorById(quote.authorId)!);
	const work = $derived(quote.workId ? workById(quote.workId) : undefined);
	const topics = $derived(quote.topicIds.map(id => topicById(id)).filter(Boolean) as NonNullable<ReturnType<typeof topicById>>[]);
	const title = $derived(deriveQuoteTitle(quote, topics));
	const citation = $derived(formatCitation(quote, author, work));

	async function copyCitation() {
		try { await navigator.clipboard.writeText(citation); } catch {}
	}
</script>

<article class="rounded-lg border border-border bg-panel p-5 md:p-6">
	<header class="mb-3 font-ui text-xs uppercase tracking-widest text-muted">
		{title}
	</header>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<div>
			<span class="font-heading text-lg">{author.name}</span>
			{#if author.dates}<span class="ml-1 text-sm text-muted">({author.dates})</span>{/if}
			<EraBadge era={author.era} />
		</div>
		{#if quote.reference}
			<span class="rounded bg-subtle/15 px-2 py-0.5 font-ui text-xs text-muted">{quote.reference}</span>
		{/if}
	</div>
	{#if quote.fr}
		<p class="mt-4 max-w-reader font-body text-lg leading-relaxed">{quote.fr}</p>
	{:else}
		<p class="mt-4 italic text-muted">Traduction française à venir.</p>
	{/if}
	<footer class="mt-5 flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap gap-2">
			{#each topics as t (t.id)}<TopicChip topic={t} />{/each}
		</div>
		{#if work}<span class="font-body italic text-sm text-muted">{work.title}</span>{/if}
	</footer>
	<div class="mt-4 flex gap-2">
		<button type="button" onclick={() => onOpenPanel?.(quote)}
			class="rounded border border-border px-3 py-1 font-ui text-xs hover:bg-subtle/10">
			Plus d'infos
		</button>
		<button type="button" onclick={copyCitation}
			class="rounded border border-border px-3 py-1 font-ui text-xs hover:bg-subtle/10"
			aria-label="Copier la citation">
			Copier la citation
		</button>
		<a href={`/citation/${quote.id}`}
			class="rounded border border-border px-3 py-1 font-ui text-xs hover:bg-subtle/10">
			Lien
		</a>
	</div>
</article>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/peres/QuoteCard.svelte src/lib/components/peres/TopicChip.svelte src/lib/components/peres/EraBadge.svelte
git commit -m "feat: QuoteCard with title row, author/era, body, topics, work, actions"
```

---

### Task 20: StudyPanel component

**Files:** Create `src/lib/components/peres/StudyPanel.svelte`.

- [ ] **Step 1: Read the reference**

Read `/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/douayrheimsbible/src/lib/components/StudyPanel.svelte`. Note its overall structure: an aside/dialog with tab navigation and per-tab content panes. Bible-specific tabs (verse, cross-refs, etc.) will be replaced.

- [ ] **Step 2: Implement a runes-only port tailored to quotes**

`src/lib/components/peres/StudyPanel.svelte`:
```svelte
<script lang="ts">
	import type { Quote } from '$lib/schema';
	import { authorById, workById } from '$lib/data';
	import { formatCitation } from '$lib/utils/format-citation';

	let { quote, onClose }: { quote: Quote | null; onClose: () => void } = $props();

	type Tab = 'auteur' | 'original' | 'sources' | 'notes';
	let active = $state<Tab>('auteur');

	const author = $derived(quote ? authorById(quote.authorId) : undefined);
	const work = $derived(quote?.workId ? workById(quote.workId) : undefined);
	const citation = $derived(quote && author ? formatCitation(quote, author, work) : '');

	async function copy(text: string) { try { await navigator.clipboard.writeText(text); } catch {} }

	$effect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape' && quote) onClose();
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

{#if quote && author}
<div role="dialog" aria-label="Plus d'infos sur la citation"
	class="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40">
	<button type="button" class="absolute inset-0 cursor-default" aria-label="Fermer le panneau"
		onclick={onClose}></button>
	<aside class="relative z-10 flex w-full max-w-lg flex-col overflow-y-auto bg-panel font-body shadow-2xl">
		<header class="flex items-center justify-between border-b border-border p-4">
			<h2 class="font-heading text-lg">{author.name}</h2>
			<button type="button" onclick={onClose} aria-label="Fermer"
				class="rounded border border-border px-2 py-1 font-ui text-sm">×</button>
		</header>

		<nav role="tablist" class="grid grid-cols-4 border-b border-border font-ui text-xs">
			{#each (['auteur','original','sources','notes'] as Tab[]) as t (t)}
				<button type="button" role="tab" aria-selected={active === t}
					onclick={() => active = t}
					class="border-r border-border px-3 py-2 last:border-r-0"
					class:bg-background={active === t}>
					{t === 'auteur' ? 'Auteur' : t === 'original' ? 'Original' : t === 'sources' ? 'Sources' : 'Notes'}
				</button>
			{/each}
		</nav>

		<div class="p-4">
			{#if active === 'auteur'}
				<dl class="space-y-2 text-sm">
					<div><dt class="font-ui text-xs uppercase text-muted">Nom</dt><dd>{author.name}{#if author.originalName} <span class="italic text-muted">({author.originalName})</span>{/if}</dd></div>
					{#if author.dates}<div><dt class="font-ui text-xs uppercase text-muted">Dates</dt><dd>{author.dates}</dd></div>{/if}
					{#if author.region}<div><dt class="font-ui text-xs uppercase text-muted">Région</dt><dd>{author.region}</dd></div>{/if}
					{#if author.function}<div><dt class="font-ui text-xs uppercase text-muted">Fonction</dt><dd>{author.function}</dd></div>{/if}
					{#if author.bioShort}<p class="mt-3 max-w-reader font-body">{author.bioShort}</p>{/if}
					<a href={`/peres/${author.slug}`} class="mt-3 inline-block font-ui text-sm text-accent-text">Voir la page complète →</a>
				</dl>
			{:else if active === 'original'}
				<div class="space-y-4">
					{#if quote.latin}<section><h3 class="font-ui text-xs uppercase text-muted">Latin</h3><p class="font-body italic">{quote.latin}</p></section>{/if}
					{#if quote.greek}<section><h3 class="font-ui text-xs uppercase text-muted">Grec / Syriaque</h3><p class="font-body italic">{quote.greek}</p></section>{/if}
					{#if !quote.latin && !quote.greek}<p class="italic text-muted">Texte original non disponible.</p>{/if}
				</div>
			{:else if active === 'sources'}
				<div class="space-y-3 text-sm">
					{#if quote.migne}
						<div>
							<dt class="font-ui text-xs uppercase text-muted">Migne</dt>
							<dd class="flex items-center gap-2"><code>{quote.migne}</code>
								<button onclick={() => copy(quote.migne!)} class="rounded border border-border px-2 py-0.5 text-xs">Copier</button>
							</dd>
						</div>
					{/if}
					<div>
						<dt class="font-ui text-xs uppercase text-muted">Citation</dt>
						<dd class="flex items-center gap-2"><span>{citation}</span>
							<button onclick={() => copy(citation)} class="rounded border border-border px-2 py-0.5 text-xs">Copier</button>
						</dd>
					</div>
					{#if quote.links.archive}<a href={quote.links.archive} target="_blank" rel="noopener" class="block text-accent-text">Voir sur Archive.org →</a>{/if}
					{#if quote.links.primary}<a href={quote.links.primary} target="_blank" rel="noopener" class="block text-accent-text">Source primaire →</a>{/if}
				</div>
			{:else}
				{#if quote.context}<section class="mb-3"><h3 class="font-ui text-xs uppercase text-muted">Contexte</h3><p class="font-body">{quote.context}</p></section>{/if}
				{#if quote.notes}<section><h3 class="font-ui text-xs uppercase text-muted">Notes</h3><p class="font-body">{quote.notes}</p></section>{/if}
				{#if !quote.context && !quote.notes}<p class="italic text-muted">Aucune note.</p>{/if}
			{/if}
		</div>
	</aside>
</div>
{/if}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/peres/StudyPanel.svelte
git commit -m "feat: StudyPanel with Auteur / Original / Sources / Notes tabs"
```

---

### Task 21: /sujets index page

**Files:** Create `src/routes/sujets/+page.svelte`.

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	import { buildTopicTree } from '$lib/data';
	const tree = buildTopicTree();
</script>

<section class="px-6 py-10">
	<h1 class="font-heading text-3xl">Sujets</h1>
	<p class="mt-2 max-w-reader text-muted">Organisés en {tree.length} sections.</p>
	<div class="mt-8 space-y-10">
		{#each tree as s (s.section)}
			<section id={`section-${s.section}`}>
				<h2 class="font-heading text-2xl">
					<span class="mr-1 text-muted">{s.section}.</span>{s.groupe}
				</h2>
				<ul class="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
					{#each s.topics as t (t.id)}
						<li>
							<a href={t.href} class="block rounded border border-border bg-panel p-3 hover:border-accent">
								<span>{t.label}</span>
								<span class="ml-1 text-xs text-muted">({t.count})</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</section>
```

- [ ] **Step 2: Verify**

```bash
npm run dev
```
Visit `/sujets`. Expected: all 8 sections rendered with their topics.

- [ ] **Step 3: Commit**

```bash
git add src/routes/sujets/+page.svelte
git commit -m "feat: /sujets index grouped by section"
```

---

### Task 22: /sujets/[slug] topic page with filter + sort

**Files:**
- Create: `src/routes/sujets/[slug]/+page.svelte`, `+page.ts`
- Create: `src/lib/components/ui/FilterChip.svelte`, `SortSelect.svelte`
- E2E test: `e2e/topic-page.spec.ts`

- [ ] **Step 1: Create FilterChip**

```svelte
<script lang="ts">
	let { label, active, onToggle }: { label: string; active: boolean; onToggle: () => void } = $props();
</script>
<button type="button" onclick={onToggle}
	class="rounded-full border px-2.5 py-0.5 font-ui text-xs transition"
	class:border-accent={active}
	class:bg-accent={active}
	class:text-accent-text={active}
	class:border-border={!active}>
	{label}
</button>
```

- [ ] **Step 2: Create SortSelect**

```svelte
<script lang="ts">
	import type { QuoteSort } from '$lib/utils/filters';
	let { value, onChange }: { value: QuoteSort; onChange: (v: QuoteSort) => void } = $props();
	const OPTIONS: Array<[QuoteSort, string]> = [
		['date-asc', 'Date (du plus ancien)'],
		['date-desc', 'Date (du plus récent)'],
		['author', 'Auteur (A–Z)'],
		['work', 'Œuvre'],
		['canonical', 'Ordre canonique']
	];
</script>
<label class="font-ui text-xs text-muted">
	Tri
	<select class="ml-2 rounded border border-border bg-panel px-2 py-1 font-ui text-sm"
		value={value}
		onchange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as QuoteSort)}>
		{#each OPTIONS as [v, label] (v)}
			<option value={v}>{label}</option>
		{/each}
	</select>
</label>
```

- [ ] **Step 3: +page.ts (load topic + quotes)**

`src/routes/sujets/[slug]/+page.ts`:
```ts
import { error } from '@sveltejs/kit';
import { topicBySlug, quotes, authors, works } from '$lib/data';

export function load({ params }) {
	const topic = topicBySlug(params.slug);
	if (!topic) throw error(404, 'Sujet introuvable');
	const matching = quotes.filter(q => q.topicIds.includes(topic.id));
	return { topic, matching, authors, works };
}
```

- [ ] **Step 4: +page.svelte (filter + sort + render)**

`src/routes/sujets/[slug]/+page.svelte`:
```svelte
<script lang="ts">
	import { applyFiltersAndSort, type QuoteFilters, type QuoteSort } from '$lib/utils/filters';
	import { eraOrder, eraLabel } from '$lib/utils/era';
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
	import FilterChip from '$lib/components/ui/FilterChip.svelte';
	import SortSelect from '$lib/components/ui/SortSelect.svelte';
	import type { Quote } from '$lib/schema';

	let { data } = $props();

	let filters = $state<QuoteFilters>({ ere: [], region: [], langue: [], pere: [] });
	let sort = $state<QuoteSort>('date-asc');
	let openQuote = $state<Quote | null>(null);

	const allRegions = $derived(Array.from(new Set(data.authors.map(a => a.region).filter(Boolean))).sort());
	const allLanguages = $derived(Array.from(new Set(data.authors.flatMap(a => a.language))).sort());

	const filtered = $derived(applyFiltersAndSort(data.matching, data.authors, filters, sort, data.works));

	function toggle<K extends keyof QuoteFilters>(key: K, value: NonNullable<QuoteFilters[K]>[number]) {
		const arr = (filters[key] ?? []) as any[];
		filters = { ...filters, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
	}
</script>

<section class="px-6 py-10">
	<header>
		<div class="font-ui text-xs uppercase tracking-widest text-muted">
			Section {data.topic.section} · {data.topic.groupe}
		</div>
		<h1 class="mt-1 font-heading text-3xl">{data.topic.label}</h1>
		{#if data.topic.description}<p class="mt-2 max-w-reader text-muted">{data.topic.description}</p>{/if}
	</header>

	<div class="my-6 flex flex-wrap items-center gap-3 border-y border-border py-3">
		<div class="flex flex-wrap items-center gap-1">
			<span class="font-ui text-xs uppercase text-muted">Ère</span>
			{#each eraOrder as e (e)}
				<FilterChip label={eraLabel(e)} active={filters.ere!.includes(e)} onToggle={() => toggle('ere', e)} />
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-1">
			<span class="font-ui text-xs uppercase text-muted">Région</span>
			{#each allRegions as r (r)}
				<FilterChip label={r!} active={filters.region!.includes(r!)} onToggle={() => toggle('region', r!)} />
			{/each}
		</div>
		<div class="flex flex-wrap items-center gap-1">
			<span class="font-ui text-xs uppercase text-muted">Langue</span>
			{#each allLanguages as l (l)}
				<FilterChip label={l} active={filters.langue!.includes(l)} onToggle={() => toggle('langue', l)} />
			{/each}
		</div>
		<div class="ml-auto"><SortSelect value={sort} onChange={(v) => sort = v} /></div>
	</div>

	<p class="mb-4 font-ui text-sm text-muted">{filtered.length} citations</p>

	<div class="space-y-6">
		{#each filtered as q (q.id)}
			<QuoteCard quote={q} onOpenPanel={(qq) => openQuote = qq} />
		{:else}
			<p class="italic text-muted">Aucune citation ne correspond à ces filtres.</p>
		{/each}
	</div>
</section>

<StudyPanel quote={openQuote} onClose={() => openQuote = null} />
```

- [ ] **Step 5: Write e2e test**

`e2e/topic-page.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('topic page renders, filters by era, sorts by date', async ({ page }) => {
	await page.goto('/sujets');
	const firstLink = page.locator('a[href^="/sujets/"]').first();
	await firstLink.click();
	await expect(page.locator('h1')).toBeVisible();

	const initialCount = await page.locator('article').count();
	expect(initialCount).toBeGreaterThan(0);

	await page.getByRole('button', { name: /Pères apostoliques/i }).click();
	const filteredCount = await page.locator('article').count();
	expect(filteredCount).toBeLessThanOrEqual(initialCount);

	await page.getByLabel('Tri').selectOption('date-desc');
	await expect(page.locator('article').first()).toBeVisible();
});
```

- [ ] **Step 6: Run**

```bash
npm run test:e2e -- e2e/topic-page.spec.ts
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/sujets/[slug]/ src/lib/components/ui/FilterChip.svelte src/lib/components/ui/SortSelect.svelte e2e/topic-page.spec.ts
git commit -m "feat: /sujets/[slug] with filter chips + sort selector"
```

---

### Task 23: /peres index and author page

**Files:** Create `src/routes/peres/+page.svelte`, `src/routes/peres/[slug]/+page.svelte`, `+page.ts`.

- [ ] **Step 1: Index page**

`src/routes/peres/+page.svelte`:
```svelte
<script lang="ts">
	import { authors } from '$lib/data';
	import { eraLabel, eraOrder } from '$lib/utils/era';
	let sortMode = $state<'chrono' | 'alpha'>('chrono');
	const grouped = $derived.by(() => {
		if (sortMode === 'alpha') {
			return [{ era: null, items: [...authors].sort((a, b) => a.name.localeCompare(b.name, 'fr')) }];
		}
		return eraOrder.map(era => ({ era, items: authors.filter(a => a.era === era).sort((a,b) => a.name.localeCompare(b.name,'fr')) }))
			.filter(g => g.items.length > 0);
	});
</script>

<section class="px-6 py-10">
	<div class="flex items-baseline justify-between">
		<h1 class="font-heading text-3xl">Pères</h1>
		<select bind:value={sortMode} class="rounded border border-border bg-panel px-2 py-1 font-ui text-sm">
			<option value="chrono">Par époque</option>
			<option value="alpha">Alphabétique</option>
		</select>
	</div>

	<div class="mt-6 space-y-8">
		{#each grouped as g}
			<section>
				{#if g.era}<h2 class="font-heading text-xl">{eraLabel(g.era)}</h2>{/if}
				<ul class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
					{#each g.items as a (a.id)}
						<li>
							<a href={`/peres/${a.slug}`} class="block rounded border border-border bg-panel p-3 hover:border-accent">
								<span class="font-heading">{a.name}</span>
								{#if a.dates}<span class="ml-2 text-sm text-muted">{a.dates}</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</section>
```

- [ ] **Step 2: Author detail load**

`src/routes/peres/[slug]/+page.ts`:
```ts
import { error } from '@sveltejs/kit';
import { authorBySlug, quotes, works } from '$lib/data';
export function load({ params }) {
	const author = authorBySlug(params.slug);
	if (!author) throw error(404, 'Père introuvable');
	const authorQuotes = quotes.filter(q => q.authorId === author.id);
	const authorWorks = works.filter(w => w.authorId === author.id);
	return { author, quotes: authorQuotes, works: authorWorks };
}
```

- [ ] **Step 3: Author detail page**

`src/routes/peres/[slug]/+page.svelte`:
```svelte
<script lang="ts">
	import EraBadge from '$lib/components/peres/EraBadge.svelte';
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
	import type { Quote } from '$lib/schema';
	let { data } = $props();
	let openQuote = $state<Quote | null>(null);
</script>

<section class="px-6 py-10">
	<header>
		<h1 class="font-heading text-3xl">{data.author.name}</h1>
		{#if data.author.originalName}<p class="italic text-muted">{data.author.originalName}</p>{/if}
		<div class="mt-2 flex flex-wrap items-center gap-3 font-ui text-sm text-muted">
			<EraBadge era={data.author.era} />
			{#if data.author.dates}<span>{data.author.dates}</span>{/if}
			{#if data.author.region}<span>· {data.author.region}</span>{/if}
			{#if data.author.function}<span>· {data.author.function}</span>{/if}
		</div>
		{#if data.author.bioShort}<p class="mt-4 max-w-reader font-body text-lg">{data.author.bioShort}</p>{/if}
	</header>

	{#if data.works.length > 0}
		<section class="mt-10">
			<h2 class="font-heading text-2xl">Œuvres</h2>
			<ul class="mt-3 space-y-1 font-body">
				{#each data.works as w (w.id)}
					<li><a href={`/oeuvres/${w.slug}`} class="hover:text-accent-text">{w.title}</a></li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="mt-10">
		<h2 class="font-heading text-2xl">Citations ({data.quotes.length})</h2>
		<div class="mt-4 space-y-6">
			{#each data.quotes as q (q.id)}
				<QuoteCard quote={q} onOpenPanel={(qq) => openQuote = qq} />
			{/each}
		</div>
	</section>
</section>
<StudyPanel quote={openQuote} onClose={() => openQuote = null} />
```

- [ ] **Step 4: Verify**

```bash
npm run dev
```
Visit `/peres` and click into an author. Expected: bio + works + quotes render; StudyPanel opens via "Plus d'infos".

- [ ] **Step 5: Commit**

```bash
git add src/routes/peres/
git commit -m "feat: /peres index + /peres/[slug] detail with works and quotes"
```

---

### Task 24: /oeuvres index and work page

**Files:** Create `src/routes/oeuvres/+page.svelte`, `src/routes/oeuvres/[slug]/+page.svelte` + `+page.ts`.

- [ ] **Step 1: Index**

`src/routes/oeuvres/+page.svelte`:
```svelte
<script lang="ts">
	import { works, authorById } from '$lib/data';
	const sorted = [...works].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
</script>
<section class="px-6 py-10">
	<h1 class="font-heading text-3xl">Œuvres</h1>
	<ul class="mt-6 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
		{#each sorted as w (w.id)}
			<li>
				<a href={`/oeuvres/${w.slug}`} class="block rounded border border-border bg-panel p-3 hover:border-accent">
					<span class="font-heading">{w.title}</span>
					<div class="text-sm text-muted">{authorById(w.authorId)?.name}</div>
				</a>
			</li>
		{/each}
	</ul>
</section>
```

- [ ] **Step 2: Detail load**

`src/routes/oeuvres/[slug]/+page.ts`:
```ts
import { error } from '@sveltejs/kit';
import { workBySlug, authorById, quotes } from '$lib/data';
export function load({ params }) {
	const work = workBySlug(params.slug);
	if (!work) throw error(404, 'Œuvre introuvable');
	const author = authorById(work.authorId)!;
	const workQuotes = quotes.filter(q => q.workId === work.id);
	return { work, author, quotes: workQuotes };
}
```

- [ ] **Step 3: Detail page**

`src/routes/oeuvres/[slug]/+page.svelte`:
```svelte
<script lang="ts">
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
	import type { Quote } from '$lib/schema';
	let { data } = $props();
	let openQuote = $state<Quote | null>(null);
</script>

<section class="px-6 py-10">
	<header>
		<h1 class="font-heading text-3xl">{data.work.title}</h1>
		{#if data.work.alternativeTitles?.length}<p class="italic text-muted">{data.work.alternativeTitles.join(' · ')}</p>{/if}
		<p class="mt-2 text-sm text-muted">par <a href={`/peres/${data.author.slug}`} class="hover:text-accent-text">{data.author.name}</a></p>
		{#if data.work.description}<p class="mt-4 max-w-reader">{data.work.description}</p>{/if}
		{#if data.work.link}<a href={data.work.link} target="_blank" rel="noopener" class="mt-2 inline-block text-accent-text">Source →</a>{/if}
	</header>

	<section class="mt-10">
		<h2 class="font-heading text-2xl">Citations ({data.quotes.length})</h2>
		<div class="mt-4 space-y-6">
			{#each data.quotes as q (q.id)}
				<QuoteCard quote={q} onOpenPanel={(qq) => openQuote = qq} />
			{/each}
		</div>
	</section>
</section>
<StudyPanel quote={openQuote} onClose={() => openQuote = null} />
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/oeuvres/
git commit -m "feat: /oeuvres index and /oeuvres/[slug] detail"
```

---

### Task 25: /citation/[id] permalink

**Files:** Create `src/routes/citation/[id]/+page.svelte` + `+page.ts`.

- [ ] **Step 1: Load**

`src/routes/citation/[id]/+page.ts`:
```ts
import { error } from '@sveltejs/kit';
import { quoteById } from '$lib/data';
export function load({ params }) {
	const id = Number(params.id);
	const quote = quoteById(id);
	if (!quote) throw error(404, 'Citation introuvable');
	return { quote };
}
```

- [ ] **Step 2: Page (auto-opens StudyPanel)**

`src/routes/citation/[id]/+page.svelte`:
```svelte
<script lang="ts">
	import QuoteCard from '$lib/components/peres/QuoteCard.svelte';
	import StudyPanel from '$lib/components/peres/StudyPanel.svelte';
	let { data } = $props();
	let openQuote = $state(data.quote);
</script>

<section class="px-6 py-10">
	<QuoteCard quote={data.quote} onOpenPanel={(q) => openQuote = q} />
</section>
<StudyPanel quote={openQuote} onClose={() => openQuote = null} />
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/citation/
git commit -m "feat: /citation/[id] permalink opens StudyPanel by default"
```

---

### Task 26: /recherche search page (client-side minisearch)

**Files:** Create `src/routes/recherche/+page.svelte`, `+page.ts`.

- [ ] **Step 1: Load (fetch the index)**

`src/routes/recherche/+page.ts`:
```ts
export const ssr = false;
export async function load({ fetch }) {
	const res = await fetch('/data/search-index.json');
	const json = await res.json();
	return { indexJson: json };
}
```

- [ ] **Step 2: Page**

`src/routes/recherche/+page.svelte`:
```svelte
<script lang="ts">
	import MiniSearch, { type SearchResult } from 'minisearch';
	import { page } from '$app/state';
	let { data } = $props();
	const ms = MiniSearch.loadJSON(JSON.stringify(data.indexJson), {
		fields: ['title', 'body'], storeFields: ['type', 'title', 'slug']
	});
	let q = $state(page.url.searchParams.get('q') ?? '');
	const results = $derived(q.trim() ? ms.search(q, { prefix: true, fuzzy: 0.2, boost: { title: 2 } }).slice(0, 50) : []);
	const PATH: Record<string, (slug: string) => string> = {
		quote: (s) => `/citation/${s.replace(/^citation-/, '')}`,
		author: (s) => `/peres/${s}`,
		work: (s) => `/oeuvres/${s}`,
		topic: (s) => `/sujets/${s}`
	};
</script>
<section class="px-6 py-10">
	<h1 class="font-heading text-3xl">Recherche</h1>
	<input type="search" bind:value={q} placeholder="Chercher…"
		class="mt-4 w-full max-w-reader rounded border border-border bg-panel px-3 py-2 font-ui" autofocus />
	{#if q.trim() && results.length === 0}
		<p class="mt-6 italic text-muted">Aucun résultat.</p>
	{/if}
	<ul class="mt-6 space-y-2">
		{#each results as r (r.id)}
			<li>
				<a href={PATH[(r as any).type]?.((r as any).slug) ?? '/'} class="block rounded border border-border bg-panel p-3 hover:border-accent">
					<span class="font-ui text-xs uppercase text-muted">{(r as any).type}</span>
					<span class="ml-2 font-heading">{(r as any).title}</span>
				</a>
			</li>
		{/each}
	</ul>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/recherche/
git commit -m "feat: /recherche page with client-side minisearch"
```

---

### Task 27: StudyPanel e2e + search e2e

**Files:** `e2e/study-panel.spec.ts`, `e2e/search.spec.ts`.

- [ ] **Step 1: StudyPanel test**

```ts
import { test, expect } from '@playwright/test';

test('Plus d\'infos opens the StudyPanel with the four tabs', async ({ page }) => {
	await page.goto('/sujets');
	await page.locator('a[href^="/sujets/"]').first().click();
	await page.getByRole('button', { name: "Plus d'infos" }).first().click();
	const panel = page.getByRole('dialog');
	await expect(panel).toBeVisible();
	for (const t of ['Auteur', 'Original', 'Sources', 'Notes']) {
		await expect(panel.getByRole('tab', { name: t })).toBeVisible();
	}
	await page.keyboard.press('Escape');
	await expect(panel).toBeHidden();
});
```

- [ ] **Step 2: Search test**

```ts
import { test, expect } from '@playwright/test';
test('/recherche returns results for a common term', async ({ page }) => {
	await page.goto('/recherche?q=foi');
	await expect(page.locator('ul li')).not.toHaveCount(0, { timeout: 3000 });
});
```

- [ ] **Step 3: Run both**

```bash
npm run test:e2e -- e2e/study-panel.spec.ts e2e/search.spec.ts
```
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/study-panel.spec.ts e2e/search.spec.ts
git commit -m "test: e2e for StudyPanel tabs/ESC and /recherche results"
```

---

### Task 28: Static pages (/a-propos, /mentions-legales)

**Files:** Create `src/routes/a-propos/+page.svelte`, `src/routes/mentions-legales/+page.svelte`.

- [ ] **Step 1: Write the two pages**

`src/routes/a-propos/+page.svelte`:
```svelte
<section class="prose mx-auto max-w-reader px-6 py-10 font-body">
	<h1 class="font-heading text-3xl">À propos</h1>
	<p>Pères de l'Église est une anthologie patristique française, organisée par sujets. Le corpus est progressivement enrichi à partir de sources primaires (Patrologie Latine, Patrologie Grecque, Corpus Christianorum) et de traductions originales.</p>
	<p>Inspiré dans sa structure thématique par <em>The Fathers Know Best</em> de Jimmy Akin, le site vise à présenter, en français, la continuité de l'enseignement de l'Église à travers les Pères.</p>
</section>
```

`src/routes/mentions-legales/+page.svelte`:
```svelte
<section class="prose mx-auto max-w-reader px-6 py-10 font-body">
	<h1 class="font-heading text-3xl">Mentions légales</h1>
	<p>Site personnel à but non commercial. Les citations sont reproduites à des fins d'érudition et de catéchèse.</p>
</section>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/a-propos/ src/routes/mentions-legales/
git commit -m "feat: à propos and mentions légales pages"
```

---

## Phase G — SEO

### Task 29: MetaTags component

**Files:** Create `src/lib/components/ui/MetaTags.svelte`. Wire into `+layout.svelte` with sensible defaults.

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
	let { title, description, canonical }: { title: string; description?: string; canonical?: string } = $props();
	const full = `${title} · Pères de l'Église`;
</script>
<svelte:head>
	<title>{full}</title>
	{#if description}<meta name="description" content={description} />{/if}
	{#if canonical}<link rel="canonical" href={canonical} />{/if}
	<meta property="og:title" content={full} />
	{#if description}<meta property="og:description" content={description} />{/if}
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
</svelte:head>
```

- [ ] **Step 2: Use it in all route pages**

In each `+page.svelte` we wrote (home, sujets index, sujets/[slug], peres, peres/[slug], oeuvres, oeuvres/[slug], citation/[id], recherche, a-propos, mentions-legales), import and render `<MetaTags title={…} description={…} />` at the top of the markup with route-appropriate values.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/ui/MetaTags.svelte src/routes/
git commit -m "feat: MetaTags component wired into all routes"
```

---

### Task 30: sitemap.xml

**Files:** Create `src/routes/sitemap.xml/+server.ts`.

- [ ] **Step 1: Implement**

```ts
import { topics, authors, works, quotes } from '$lib/data';

const STATIC = ['/', '/sujets', '/peres', '/oeuvres', '/recherche', '/a-propos', '/mentions-legales'];

export const prerender = true;

export function GET() {
	const urls: string[] = [
		...STATIC,
		...topics.map(t => `/sujets/${t.slug}`),
		...authors.map(a => `/peres/${a.slug}`),
		...works.map(w => `/oeuvres/${w.slug}`),
		...quotes.map(q => `/citation/${q.id}`)
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>https://pereseglise.pages.dev${u}</loc></url>`).join('\n')}
</urlset>`;
	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
```

- [ ] **Step 2: Visit `/sitemap.xml` in dev to verify**

- [ ] **Step 3: Commit**

```bash
git add src/routes/sitemap.xml/
git commit -m "feat: sitemap.xml endpoint listing all routes"
```

---

### Task 31: llms.txt

**Files:** Create `src/routes/llms.txt/+server.ts`.

- [ ] **Step 1: Implement**

```ts
import { topics, authors, works, quotes } from '$lib/data';
export const prerender = true;
export function GET() {
	const body = [
		'# Pères de l\'Église',
		'Anthologie patristique française organisée par sujets.',
		'',
		`## Stats`,
		`- Auteurs: ${authors.length}`,
		`- Œuvres: ${works.length}`,
		`- Sujets: ${topics.length}`,
		`- Citations: ${quotes.length}`,
		'',
		'## Routes',
		'- /sujets',
		'- /sujets/[slug]',
		'- /peres',
		'- /peres/[slug]',
		'- /oeuvres',
		'- /oeuvres/[slug]',
		'- /citation/[id]',
		'- /recherche'
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/llms.txt/
git commit -m "feat: llms.txt corpus summary"
```

---

## Phase H — Admin (dev-only)

### Task 32: Admin route guard + atomic JSON writer

**Files:** Create `src/lib/admin/atomic-write.ts`, test. Create `src/routes/admin/+layout.server.ts`, `+layout.svelte`, `+page.svelte`. E2E: `e2e/admin-dev-only.spec.ts`.

- [ ] **Step 1: Atomic writer + test**

`src/lib/admin/atomic-write.ts`:
```ts
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function atomicWriteJson(path: string, data: unknown) {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
	writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
	renameSync(tmp, path);
}
```

`src/lib/admin/atomic-write.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { atomicWriteJson } from './atomic-write';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('atomicWriteJson', () => {
	it('writes JSON to disk', () => {
		const dir = mkdtempSync(join(tmpdir(), 'awj-'));
		const path = join(dir, 'out.json');
		atomicWriteJson(path, { hello: 'world' });
		expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual({ hello: 'world' });
	});
});
```

Run:
```bash
npm run test:unit -- src/lib/admin/atomic-write.test.ts
```

- [ ] **Step 2: Guard**

`src/routes/admin/+layout.server.ts`:
```ts
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
export function load() {
	if (!dev) throw error(404, 'Not found');
	return {};
}
```

- [ ] **Step 3: Admin shell**

`src/routes/admin/+layout.svelte`:
```svelte
<script lang="ts">
	let { children } = $props();
</script>
<div class="px-6 py-6">
	<nav class="mb-6 flex gap-4 border-b border-border pb-2 font-ui text-sm">
		<a href="/admin">Accueil</a>
		<a href="/admin/auteurs">Auteurs</a>
		<a href="/admin/oeuvres">Œuvres</a>
		<a href="/admin/sujets">Sujets</a>
		<a href="/admin/citations">Citations</a>
		<a href="/admin/gaps">Gaps</a>
	</nav>
	{@render children()}
</div>
```

`src/routes/admin/+page.svelte`:
```svelte
<h1 class="font-heading text-3xl">Admin</h1>
<p class="mt-3 text-muted">Cette interface n'est accessible qu'en mode développement.</p>
```

- [ ] **Step 4: E2E (dev-only assertion)**

`e2e/admin-dev-only.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
test('admin is reachable in dev', async ({ page }) => {
	await page.goto('/admin');
	await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});
```

Note: a "404 in production" test requires running `npm run build && npm run preview` separately; document this in `tests/README.md` and skip from the default suite.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/ src/routes/admin/ e2e/admin-dev-only.spec.ts
git commit -m "feat: dev-only /admin shell with route guard + atomic JSON writer"
```

---

### Task 33: Admin CRUD endpoint

**Files:** Create `src/routes/admin/api/[entity]/+server.ts`.

- [ ] **Step 1: Implement**

```ts
import { error, json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWriteJson } from '$lib/admin/atomic-write';
import { AuthorSchema, WorkSchema, TopicSchema, QuoteSchema } from '$lib/schema';

const FILE: Record<string, string> = {
	authors: 'authors.json',
	works: 'works.json',
	topics: 'topics.json',
	quotes: 'quotes.json'
};
const SCHEMA: Record<string, any> = {
	authors: AuthorSchema, works: WorkSchema, topics: TopicSchema, quotes: QuoteSchema
};

function pathFor(entity: string) {
	return join(process.cwd(), 'src/lib/data', FILE[entity]);
}

function loadAll(entity: string): any[] {
	return JSON.parse(readFileSync(pathFor(entity), 'utf-8'));
}

function assertDev() { if (!dev) throw error(404); }
function assertEntity(e: string) { if (!FILE[e]) throw error(404, 'Unknown entity'); }

export async function GET({ params }) {
	assertDev();
	assertEntity(params.entity);
	return json(loadAll(params.entity));
}

export async function PUT({ params, request }) {
	assertDev();
	assertEntity(params.entity);
	const body = await request.json();
	const parsed = SCHEMA[params.entity].array().safeParse(body);
	if (!parsed.success) throw error(400, JSON.stringify(parsed.error.issues));
	atomicWriteJson(pathFor(params.entity), parsed.data);
	return json({ ok: true, count: parsed.data.length });
}
```

- [ ] **Step 2: Manual test**

```bash
npm run dev
curl http://localhost:5173/admin/api/topics | head -c 200
```
Expected: JSON array of topics.

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/api/
git commit -m "feat: admin api — GET/PUT JSON collections with zod validation"
```

---

### Task 34: Admin entity list + edit forms

**Files:** `src/routes/admin/auteurs/+page.svelte`, `oeuvres/+page.svelte`, `sujets/+page.svelte`, `citations/+page.svelte`.

These pages share a pattern: fetch the collection via `/admin/api/<entity>`, render a sortable/searchable list on the left, an editable form on the right. Pick the record by clicking a row.

- [ ] **Step 1: Create a shared admin form helper**

`src/lib/admin/form-state.svelte.ts`:
```ts
export function createFormState<T>(initial: T[]) {
	const state = $state({ items: initial, selectedIdx: -1, search: '', dirty: false });
	return state;
}
```

- [ ] **Step 2: Implement the four pages**

Each follows this skeleton (example for `auteurs`):

`src/routes/admin/auteurs/+page.svelte`:
```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Author } from '$lib/schema';
	let items = $state<Author[]>([]);
	let selectedIdx = $state(-1);
	let dirty = $state(false);
	let search = $state('');
	let saveError = $state('');

	onMount(async () => {
		const res = await fetch('/admin/api/authors');
		items = await res.json();
	});

	const filtered = $derived(items
		.map((a, i) => ({ a, i }))
		.filter(({ a }) => a.name.toLowerCase().includes(search.toLowerCase())));

	const selected = $derived(selectedIdx >= 0 ? items[selectedIdx] : null);

	function update<K extends keyof Author>(key: K, value: Author[K]) {
		if (!selected) return;
		items[selectedIdx] = { ...selected, [key]: value };
		dirty = true;
	}

	async function save() {
		const res = await fetch('/admin/api/authors', {
			method: 'PUT', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(items)
		});
		if (!res.ok) { saveError = await res.text(); return; }
		saveError = '';
		dirty = false;
	}
</script>

<h1 class="font-heading text-2xl">Auteurs ({items.length})</h1>
<div class="mt-4 grid grid-cols-[300px_1fr] gap-6">
	<aside class="border-r border-border pr-4">
		<input type="search" placeholder="Filtrer…" bind:value={search}
			class="w-full rounded border border-border bg-panel px-2 py-1" />
		<ul class="mt-2 max-h-[70vh] overflow-y-auto">
			{#each filtered as { a, i } (a.id)}
				<li>
					<button type="button" onclick={() => { selectedIdx = i; }}
						class="block w-full rounded px-2 py-1 text-left hover:bg-subtle/10"
						class:bg-subtle\/20={selectedIdx === i}>
						{a.name} <span class="text-xs text-muted">#{a.id}</span>
					</button>
				</li>
			{/each}
		</ul>
	</aside>
	<div>
		{#if selected}
			<form class="space-y-3" onsubmit={(e) => { e.preventDefault(); save(); }}>
				<label class="block">Nom
					<input class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={selected.name} oninput={(e) => update('name', (e.currentTarget as HTMLInputElement).value)} />
				</label>
				<label class="block">Nom d'origine
					<input class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={selected.originalName ?? ''} oninput={(e) => update('originalName', (e.currentTarget as HTMLInputElement).value || undefined)} />
				</label>
				<label class="block">Dates
					<input class="mt-1 w-full rounded border border-border bg-panel px-2 py-1"
						value={selected.dates ?? ''} oninput={(e) => update('dates', (e.currentTarget as HTMLInputElement).value || undefined)} />
				</label>
				<label class="block">Bio courte
					<textarea class="mt-1 h-32 w-full rounded border border-border bg-panel px-2 py-1"
						oninput={(e) => update('bioShort', (e.currentTarget as HTMLTextAreaElement).value || undefined)}
						>{selected.bioShort ?? ''}</textarea>
				</label>
				<button type="submit" disabled={!dirty}
					class="rounded border border-border bg-accent px-4 py-1 font-ui text-sm text-accent-text disabled:opacity-50">
					Enregistrer
				</button>
				{#if saveError}<p class="text-red-600">{saveError}</p>{/if}
			</form>
		{:else}
			<p class="italic text-muted">Sélectionnez un auteur.</p>
		{/if}
	</div>
</div>
```

Implement `/admin/oeuvres`, `/admin/sujets`, `/admin/citations` following the same skeleton, exposing the appropriate fields:
- **Œuvres**: title, alternativeTitles (comma-input), authorId (select from authors), description, link.
- **Sujets**: label, section (dropdown I-VIII), groupe, description.
- **Citations** (the rich one): authorId (select), workId (select), topicIds (multi-select), reference, fr, en, latin, greek, context, migne, links.primary, links.archive, notes, status, title.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```
Open `/admin/auteurs`. Edit any author's `bioShort`, click Enregistrer. Reload — change persisted. Re-run `npm run prebuild` and confirm gaps report `authors missing bioShort` decreased.

- [ ] **Step 4: Commit**

```bash
git add src/lib/admin/form-state.svelte.ts src/routes/admin/auteurs src/routes/admin/oeuvres src/routes/admin/sujets src/routes/admin/citations
git commit -m "feat: admin edit forms for all four entities"
```

---

### Task 35: Admin Gaps tab

**Files:** Create `src/routes/admin/gaps/+page.svelte`, `+page.ts`.

- [ ] **Step 1: Load — compute gaps server-side**

`src/routes/admin/gaps/+page.ts`:
```ts
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { authors, works, quotes } from '$lib/data';
export function load() {
	if (!dev) throw error(404);
	const authorIds = new Set(authors.map(a => a.id));
	const workIds = new Set(works.map(w => w.id));
	return {
		noFr: quotes.filter(q => !q.fr?.trim()).map(q => q.id),
		noOriginal: quotes.filter(q => !q.latin && !q.greek).map(q => q.id),
		noTitle: quotes.filter(q => !q.title?.trim()).map(q => q.id),
		brokenAuthor: quotes.filter(q => !authorIds.has(q.authorId)).map(q => q.id),
		brokenWork: quotes.filter(q => q.workId != null && !workIds.has(q.workId)).map(q => q.id),
		noArchive: quotes.filter(q => !q.links.archive).map(q => q.id),
		authorsMissingBio: authors.filter(a => !a.bioShort?.trim()).map(a => a.id),
		worksMissingDescription: works.filter(w => !w.description?.trim()).map(w => w.id)
	};
}
```

- [ ] **Step 2: Page**

`src/routes/admin/gaps/+page.svelte`:
```svelte
<script lang="ts">
	let { data } = $props();
	const groups = [
		['Quotes sans FR', data.noFr],
		['Quotes sans original', data.noOriginal],
		['Quotes sans titre', data.noTitle],
		['Quotes broken authorId', data.brokenAuthor],
		['Quotes broken workId', data.brokenWork],
		['Quotes sans archive', data.noArchive],
		['Auteurs sans bio', data.authorsMissingBio],
		['Œuvres sans description', data.worksMissingDescription]
	] as const;
</script>
<h1 class="font-heading text-2xl">Gaps</h1>
<div class="mt-4 space-y-6">
	{#each groups as [label, ids] (label)}
		<section>
			<h2 class="font-heading text-lg">{label} ({ids.length})</h2>
			<ul class="mt-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto">
				{#each ids.slice(0, 200) as id (id)}
					<li>
						<a href={label.startsWith('Quotes') ? `/admin/citations#${id}` : label.startsWith('Auteurs') ? `/admin/auteurs#${id}` : `/admin/oeuvres#${id}`}
							class="rounded border border-border bg-panel px-2 py-0.5 text-xs hover:border-accent">#{id}</a>
					</li>
				{/each}
				{#if ids.length > 200}<li class="text-xs text-muted">… +{ids.length - 200}</li>{/if}
			</ul>
		</section>
	{/each}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/admin/gaps/
git commit -m "feat: admin gaps tab listing all missing-data buckets"
```

---

## Phase I — Final polish

### Task 36: OG image generation script

**Files:** Create `scripts/generate-og-image.mjs`.

- [ ] **Step 1: Copy + adapt from catechismecatholique**

```bash
cp "/Users/Janvier/Documents/catechismecatholique/scripts/generate-og-image.mjs" \
   "/Users/Janvier/Library/Mobile Documents/com~apple~CloudDocs/for-the-kingdom/pereseglise/scripts/generate-og-image.mjs"
```

Edit the script: change the displayed title to "Pères de l'Église" and the subtitle to "Anthologie patristique française". Output to `static/og-image.png`.

- [ ] **Step 2: Run it**

```bash
node scripts/generate-og-image.mjs
```
Expected: `static/og-image.png` created.

- [ ] **Step 3: Reference in MetaTags**

In `src/lib/components/ui/MetaTags.svelte`, add:
```svelte
<meta property="og:image" content="/og-image.png" />
```

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-og-image.mjs static/og-image.png src/lib/components/ui/MetaTags.svelte
git commit -m "feat: generate OG image and reference in MetaTags"
```

---

### Task 37: Lint + check + final e2e pass

- [ ] **Step 1: Lint and format**

```bash
npm run format
npm run lint
```
Expected: clean.

- [ ] **Step 2: Type check**

```bash
npm run check
```
Expected: 0 errors.

- [ ] **Step 3: Full test suite**

```bash
npm test
```
Expected: all unit tests + all e2e tests pass.

- [ ] **Step 4: Production build**

```bash
npm run build
npm run preview
```
Open the preview URL, click around, verify the site is functional.

- [ ] **Step 5: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: run prettier + final QA pass" || echo "nothing to commit"
```

---

## Done

v1 ships when Task 37 is green. Phase 2 (bio/work enhancement, bespoke quote titles) and Phase 3 (scripture refs pipeline, archive link backfill) are described in the spec at `docs/superpowers/specs/2026-05-21-peres-eglise-design.md` and get their own plans when their turn comes.
