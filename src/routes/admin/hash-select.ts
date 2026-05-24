// Shared hash-deeplink helper for the admin list editors. Reads
// location.hash on call (and on hashchange), looks up the index of the
// matching id in the provided list, and invokes a callback.
//
// Usage in a Svelte 5 page that loads `items: T[]`:
//   $effect(() => watchHashSelection(items, (idx) => (selectedIdx = idx)));

export function watchHashSelection<T extends { id: number }>(
	items: T[],
	select: (idx: number) => void
): () => void {
	if (typeof window === 'undefined') return () => {};

	function read() {
		const m = window.location.hash.match(/^#(\d+)$/);
		if (!m) return;
		const id = Number(m[1]);
		const idx = items.findIndex((x) => x.id === id);
		if (idx < 0) return;
		select(idx);
		queueMicrotask(() => {
			document.getElementById(`row-${id}`)?.scrollIntoView({ block: 'center' });
		});
	}

	read();
	window.addEventListener('hashchange', read);
	return () => window.removeEventListener('hashchange', read);
}
