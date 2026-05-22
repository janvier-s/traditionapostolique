/*
 * Reading mode preference. Two modes for now:
 *   · `read`  · the minimal, distraction-free layout (default).
 *   · `study` · adds filters, sorting, per-quote actions, and the
 *               study-panel drawer · all styled to match Read mode.
 *
 * Persisted to localStorage so the choice survives navigation and
 * reloads. Mirrors the pattern in `theme.svelte.ts`.
 */
export type Mode = 'read' | 'study';

const KEY = 'mode';
const MODES: Mode[] = ['read', 'study'];

function load(): Mode {
	if (typeof localStorage === 'undefined') return 'read';
	const v = localStorage.getItem(KEY);
	return MODES.includes(v as Mode) ? (v as Mode) : 'read';
}

export const mode = $state({ value: load() });

export function setMode(m: Mode) {
	mode.value = m;
	if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, m);
}

export function toggleMode() {
	setMode(mode.value === 'read' ? 'study' : 'read');
}
