import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('sidebar store', () => {
	beforeEach(() => {
		vi.resetModules();
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
	});
	it('defaults to open', async () => {
		const { sidebar } = await import('./sidebar.svelte');
		expect(sidebar.open).toBe(true);
	});
	it('toggle flips and persists', async () => {
		const { sidebar, toggleSidebar } = await import('./sidebar.svelte');
		toggleSidebar();
		expect(sidebar.open).toBe(false);
		expect(localStorage.getItem('sidebar.open')).toBe('false');
	});
});
