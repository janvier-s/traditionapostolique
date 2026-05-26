// Convert quote text with minimal markdown into HTML for `{@html}` use.
//
// Supported grammar:
//   *foo*           →  <em>foo</em>
//   CEC §123        →  <a href="https://catechismecatholique.fr/cec/123">CEC §123</a>
//   CEC §123-125    →  <a href="https://catechismecatholique.fr/cec/123-125">CEC §123-125</a>
//                       (the upstream site handles ranged URLs natively)
//
// Rules:
//   - The italic contents must start and end with a non-whitespace
//     character, so `*a *b*` does NOT half-match.
//   - Italic contents cannot span a newline.
//   - All input is HTML-escaped before substitution, so the output is
//     safe to inject via `{@html}`.
export function renderFr(text: string | undefined | null): string {
	if (!text) return '';
	const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	let result = esc.replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '<em>$1</em>');
	result = result.replace(
		/CEC §(\d+)(-\d+)?/g,
		(_, n: string, range: string | undefined) => {
			const suffix = range ?? '';
			return `<a href="https://catechismecatholique.fr/cec/${n}${suffix}" target="_blank" rel="noopener" class="underline-offset-4 hover:underline hover:text-accent">CEC §${n}${suffix}</a>`;
		}
	);
	return result;
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
