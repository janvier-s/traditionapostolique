import { test, expect } from '@playwright/test';

test("Plus d'infos opens the StudyPanel with the four tabs", async ({ page }) => {
	await page.goto('/sujets');
	// click into the first populated topic from the index grid (not the sidebar)
	await page.locator('main a[href^="/sujets/"]').first().click();
	const opener = page.getByRole('button', { name: "Plus d'infos" }).first();
	await opener.click();

	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();

	for (const tab of ['Auteur', 'Original', 'Sources', 'Notes']) {
		await expect(dialog.getByRole('tab', { name: tab })).toBeVisible();
	}

	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
});
