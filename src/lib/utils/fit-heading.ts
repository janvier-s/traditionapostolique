// Svelte action: if the heading wraps to more than one line at its
// current font size (typically because CSS `hyphens: auto` had to break
// the word), drop the font size to a smaller value and re-measure.
//
// Usage: <h2 use:fitHeading={{ shrunkPx: 20 }}>{name}</h2>
//
// The element must have a measurable line-height. We compare the
// rendered box height against ~1.5× the line-height to decide whether
// the text wrapped. Re-runs on ResizeObserver and when content changes.
export function fitHeading(
	node: HTMLElement,
	opts: { shrunkPx?: number } = {}
) {
	const shrunkPx = opts.shrunkPx ?? 20;
	let originalSize = '';

	function measure() {
		// Reset before measuring so we always evaluate at the "natural" size.
		if (originalSize) node.style.fontSize = originalSize;
		// Heuristic for "did CSS hyphens: auto have to break a word":
		// measure the widest single word in the heading and compare to
		// the available width. If even the longest token won't fit on a
		// line, the browser will hyphenate it. Normal word-wrap (between
		// words) is fine and should NOT trigger a shrink.
		const inner = (node.querySelector('a') ?? node) as HTMLElement;
		const rect = inner.getBoundingClientRect();
		const containerWidth = rect.width;
		const text = (inner.textContent ?? '').replace(/\s+/g, ' ').trim();
		if (!text || containerWidth <= 0) return;
		const probe = document.createElement('span');
		const cs = window.getComputedStyle(inner);
		probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:-9999px;font:${cs.font};letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform};`;
		document.body.appendChild(probe);
		let widest = 0;
		for (const w of text.split(' ')) {
			probe.textContent = w;
			widest = Math.max(widest, probe.getBoundingClientRect().width);
		}
		probe.remove();
		if (widest > containerWidth + 0.5) {
			if (!originalSize) originalSize = node.style.fontSize;
			node.style.fontSize = `${shrunkPx}px`;
		}
	}

	requestAnimationFrame(measure);
	const ro = new ResizeObserver(() => requestAnimationFrame(measure));
	ro.observe(node);
	const mo = new MutationObserver(() => requestAnimationFrame(measure));
	mo.observe(node, { childList: true, characterData: true, subtree: true });

	return {
		destroy() {
			ro.disconnect();
			mo.disconnect();
		}
	};
}
