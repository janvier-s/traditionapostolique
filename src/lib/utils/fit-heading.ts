// Svelte action: shrink a heading's font-size when the browser would
// have to hyphenate (i.e. the widest single word doesn't fit on a line
// at the natural size). Restores the natural size when the container
// grows back. Re-runs on resize and on text mutations.
//
// Usage: <h2 use:fitHeading={{ shrunkPx: 20 }}>{name}</h2>
export function fitHeading(node: HTMLElement, opts: { shrunkPx?: number } = {}) {
	const shrunkPx = opts.shrunkPx ?? 20;
	// Capture the natural inline font-size BEFORE we ever touch it so
	// future resets restore the actual original value, not the shrunk
	// one. Falls back to '' when the element relies on stylesheet rules,
	// which clears any inline override.
	const naturalSize = node.style.fontSize;
	let rafId = 0;
	let shrunk = false;

	function measure() {
		rafId = 0;
		// Always reset to the natural size before measuring so we
		// evaluate against the un-shrunk layout. Otherwise once we shrink
		// we'd keep measuring the shrunk text and never widen back up.
		if (shrunk) {
			node.style.fontSize = naturalSize;
			shrunk = false;
		}
		const inner = (node.querySelector('a') ?? node) as HTMLElement;
		const containerWidth = inner.getBoundingClientRect().width;
		const text = (inner.textContent ?? '').replace(/\s+/g, ' ').trim();
		if (!text || containerWidth <= 0) return;
		const cs = window.getComputedStyle(inner);
		const probe = document.createElement('span');
		probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:-9999px;font:${cs.font};letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform};`;
		document.body.appendChild(probe);
		let widest = 0;
		for (const w of text.split(' ')) {
			probe.textContent = w;
			widest = Math.max(widest, probe.getBoundingClientRect().width);
		}
		probe.remove();
		if (widest > containerWidth + 0.5) {
			node.style.fontSize = `${shrunkPx}px`;
			shrunk = true;
		}
	}

	function schedule() {
		// Coalesce rapid resize / mutation callbacks into a single RAF.
		if (rafId) cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(measure);
	}

	schedule();
	const ro = new ResizeObserver(schedule);
	ro.observe(node);
	const mo = new MutationObserver(schedule);
	mo.observe(node, { childList: true, characterData: true, subtree: true });

	return {
		destroy() {
			if (rafId) cancelAnimationFrame(rafId);
			ro.disconnect();
			mo.disconnect();
		}
	};
}
