// Bare Roman numerals 1–21, used by call sites that need to render the
// ordinal suffix themselves (e.g. a chip that wraps the lowercase suffix
// in its own span to escape an uppercase parent).
export const ROMAN_NUMERALS = [
	'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
	'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'
] as const;

// French ordinal suffix for a century number: `er` for the 1st, `e` for
// every other one. Mirrors how French handles "1er" vs "2e".
export function ordinalSuffix(century: number): 'er' | 'e' {
	return century === 1 ? 'er' : 'e';
}

// Parse the latest year present in a `dates` string like "270-346",
// "c. 6-100", or "?-167". Returns `null` when no year is recoverable.
export function latestYear(dates: string | null | undefined): number | null {
	if (!dates) return null;
	const matches = dates.match(/\d{1,4}/g);
	if (!matches) return null;
	return Math.max(...matches.map(Number));
}

// Numeric century (1-indexed) for the year, or null when undated.
export function centuryNumber(dates: string | null | undefined): number | null {
	const y = latestYear(dates);
	return y === null ? null : Math.ceil(y / 100);
}

// "IVe siècle". Returns `''` when the dates string carries no year.
export function centuryLabel(dates: string | null | undefined): string {
	const c = centuryNumber(dates);
	if (c === null) return '';
	const r = ROMAN_NUMERALS[c - 1] ?? `${c}`;
	return `${r}${ordinalSuffix(c)} siècle`;
}

// Machine-readable year for the HTML `<time datetime>` attribute.
// Returns a 4-digit zero-padded year drawn from the earliest year
// present in the string (typical for an author's birth or a work's
// composition date), or null when no year is recoverable.
export function isoYear(dates: string | null | undefined): string | null {
	if (!dates) return null;
	const matches = dates.match(/\d{1,4}/g);
	if (!matches) return null;
	const earliest = Math.min(...matches.map(Number));
	return String(earliest).padStart(4, '0');
}

// Bare ordinal ("IVe", "Ier") with no "siècle" suffix.
export function centuryOrdinal(dates: string | null | undefined): string {
	const c = centuryNumber(dates);
	if (c === null) return '';
	const r = ROMAN_NUMERALS[c - 1] ?? `${c}`;
	return `${r}${ordinalSuffix(c)}`;
}
