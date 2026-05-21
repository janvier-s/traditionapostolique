import { test, expect } from '@playwright/test';

test('admin returns 404 in production preview', async ({ page }) => {
	const response = await page.goto('/admin');
	expect(response?.status()).toBe(404);
});
