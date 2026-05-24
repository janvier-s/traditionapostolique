// Convert quote text with minimal markdown into HTML for `{@html}` use.
//
// Supported grammar:
//   *foo*        →  <em>foo</em>
//
// Rules:
//   - The contents must start and end with a non-whitespace character,
//     so `*a *b*` does NOT half-match (no `<em>a </em>b*` mess).
//   - The contents cannot span a newline.
//   - All input is HTML-escaped before italic substitution, so the
//     output is safe to inject via `{@html}`.
export function renderFr(text: string | undefined | null): string {
	if (!text) return '';
	const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return esc.replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '<em>$1</em>');
}

// HTML-escape an arbitrary string so it's safe to compose into an
// `{@html}` payload alongside trusted markup. Use this whenever a
// helper builds HTML from user/data-controlled text.
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
