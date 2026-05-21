import { test, expect } from '@playwright/test';

test('sidebar is visible by default and lists all 8 sections', async ({ page }) => {
	await page.goto('/');
	const aside = page.locator('aside[aria-label="Plan des sujets"]');
	await expect(aside).toBeVisible();
	for (const s of ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']) {
		await expect(aside.getByText(new RegExp(`^${s}\\.`))).toBeVisible();
	}
});

test('toggle hides the sidebar and persists across reloads', async ({ page }) => {
	await page.goto('/');
	const aside = page.locator('aside[aria-label="Plan des sujets"]');
	await expect(aside).toBeVisible();
	await page.getByRole('button', { name: /plan des sujets/i }).click();
	await expect(aside).toBeHidden();
	await page.reload();
	await expect(page.locator('aside[aria-label="Plan des sujets"]')).toBeHidden();
});

test('filter narrows the topic list', async ({ page }) => {
	await page.goto('/');
	const aside = page.locator('aside[aria-label="Plan des sujets"]');
	await expect(aside).toBeVisible();
	const visibleItems = aside.locator('li a:visible');
	// Baseline: all 49 topics rendered before filtering.
	await expect.poll(async () => visibleItems.count()).toBe(49);
	await page.getByPlaceholder('Filtrer les sujets…').fill('dieu');
	// Filter is reactive; poll until the count drops.
	await expect.poll(async () => visibleItems.count(), { timeout: 5000 }).toBeLessThan(49);
	const count = await visibleItems.count();
	expect(count).toBeGreaterThan(0);
});
