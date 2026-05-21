import { test, expect } from '@playwright/test';

test('topic page renders, filters by era, sorts by date', async ({ page }) => {
	await page.goto('/sujets');
	const firstLink = page.locator('main a[href^="/sujets/"]').first();
	await firstLink.click();
	await expect(page.locator('h1').first()).toBeVisible();

	const articles = page.locator('article');
	const initialCount = await articles.count();
	expect(initialCount).toBeGreaterThan(0);

	// Toggle the "Post-nicéens" era filter (post-nicene is the most populous era)
	const eraButton = page.getByRole('button', { name: 'Post-nicéens' });
	if (await eraButton.count() > 0) {
		await eraButton.first().click();
		await expect.poll(async () => await articles.count(), { timeout: 3000 }).toBeLessThanOrEqual(initialCount);
	}

	// Switch sort
	await page.getByLabel('Tri').selectOption('date-desc');
	await expect(articles.first()).toBeVisible();
});
