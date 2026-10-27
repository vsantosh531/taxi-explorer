import { test, expect } from '@playwright/test';

test('multi-select ZIP filter shows selected ZIPs and updates the KPIs', async ({ page }) => {
  await page.goto('/analytics');

  await expect(page.getByText('11,065', { exact: true })).toBeVisible({ timeout: 30000 });

  await page.getByRole('combobox', { name: 'Pickup ZIP' }).click();
  await page.getByRole('option', { name: '10001' }).click();
  await page.getByRole('option', { name: '10003' }).click();
  await page.keyboard.press('Escape');

  const selected = page.getByLabel('Selected ZIPs');
  await expect(selected.getByText('10001')).toBeVisible();
  await expect(selected.getByText('10003')).toBeVisible();
  await expect(page.getByText('1,256', { exact: true })).toBeVisible({ timeout: 30000 });

  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.getByText('11,065', { exact: true })).toBeVisible({ timeout: 30000 });
});
