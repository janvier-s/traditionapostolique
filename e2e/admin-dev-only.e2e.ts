import { test, expect } from '@playwright/test';

test('admin is reachable in dev', async ({ page }) => {
	await page.goto('/admin');
	await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});
