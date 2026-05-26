// Synchronous theme bootstrap. Loaded as <script src> in <head> BEFORE
// any paint so the correct theme class lands on <html> + inline bg/fg
// styles are applied to documentElement. External script (not inline)
// because the page's CSP doesn't include a hash for our inline payload.
// Mirrors the load() logic in src/lib/stores/theme.svelte.ts.
(function () {
	try {
		var t = localStorage.getItem('theme');
		var palette = {
			sepia: { bg: '#f2e8d8', fg: '#2c1e10' },
			dark: { bg: '#111113', fg: '#e8ddd0' },
			amoled: { bg: '#000000', fg: '#e0e0e0' }
		};
		if (palette[t]) {
			document.documentElement.classList.add(t);
			document.documentElement.style.backgroundColor = palette[t].bg;
			document.documentElement.style.color = palette[t].fg;
			document.documentElement.style.colorScheme = t === 'sepia' ? 'light' : 'dark';
		} else {
			document.documentElement.style.colorScheme = 'light';
		}
	} catch (e) {
		/* localStorage unavailable (privacy mode); fall through to light */
	}
})();
