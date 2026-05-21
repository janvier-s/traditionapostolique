import { test, expect } from '@playwright/test';

test('/recherche returns results for a common term', async ({ page }) => {
	await page.goto('/recherche?q=Dieu');
	const results = page.locator('ul > li');
	await expect.poll(async () => await results.count(), { timeout: 5000 }).toBeGreaterThan(0);
});
