// Migne reference helpers. The data has stray non-Migne strings left
// over from the spreadsheet (footnotes, URLs, running text) so anything
// that looks at the `migne` field should validate it first.

// True when the string starts with PG/PL followed by a volume number.
export function looksLikeMigne(s: string): boolean {
	return /\b(PG|PL)\b[\s.]*(vol\.?\s*)?\d/i.test(s);
}

// Parse a Migne reference into its series, volume, and column. Returns
// null when the string isn't a recognisable Migne reference.
export function parseMigne(s: string): { series: 'PG' | 'PL'; volume: number; col: number } | null {
	const m = s.match(/\b(PG|PL)\b[\s.]*(?:vol\.?\s*)?(\d+)[\s,]*(?:col\.?\s*)?(\d+)?/i);
	if (!m || !m[1] || !m[2]) return null;
	return {
		series: m[1].toUpperCase() as 'PG' | 'PL',
		volume: Number(m[2]),
		col: m[3] ? Number(m[3]) : 0
	};
}
