import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('theme store', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		const storage: Record<string, string> = {};
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => storage[k] ?? null,
			setItem: (k: string, v: string) => {
				storage[k] = v;
			},
			removeItem: (k: string) => {
				delete storage[k];
			}
		});
		vi.stubGlobal('document', {
			documentElement: { classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() } }
		});
	});

	it('cycles through light / sepia / dark / amoled', async () => {
		const { theme, cycleTheme } = await import('./theme.svelte');
		expect(theme.value).toBe('light');
		cycleTheme();
		expect(theme.value).toBe('sepia');
		cycleTheme();
		expect(theme.value).toBe('dark');
		cycleTheme();
		expect(theme.value).toBe('amoled');
		cycleTheme();
		expect(theme.value).toBe('light');
	});

	it('persists choice to localStorage', async () => {
		const { cycleTheme } = await import('./theme.svelte');
		cycleTheme();
		expect(localStorage.getItem('theme')).toBe('sepia');
	});
});
