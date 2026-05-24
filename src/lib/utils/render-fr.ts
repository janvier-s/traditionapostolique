// Convert quote text with minimal markdown (`*italic*`) into HTML.
// Escapes HTML first to be safe with `{@html}`.
export function renderFr(text: string | undefined | null): string {
	if (!text) return '';
	const esc = text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
	return esc.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}
