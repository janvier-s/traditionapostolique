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
	const idx = ORDER.indexOf(theme.value);
	const nextIdx = idx >= 0 ? (idx + 1) % ORDER.length : 1;
	const next = ORDER[nextIdx] as Theme;
	setTheme(next);
}
