import { test, expect } from '@playwright/test';

test('analytics page loads with charts and table', async ({ page }) => {
  await page.goto('/analytics');

  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Total trips', { exact: true })).toBeVisible();
  await expect(page.getByText('Average fare', { exact: true })).toBeVisible();
  await expect(page.getByText('Trips by hour', { exact: true })).toBeVisible();
  await expect(page.getByText('Trips per day', { exact: true })).toBeVisible();
  await expect(page.getByText('Trips by fare range', { exact: true })).toBeVisible();
  await expect(page.getByText('Trip details', { exact: true })).toBeVisible();

  await expect(page.getByLabel('Start date')).toHaveValue('2016-02-01');
  await expect(page.getByLabel('End date')).toHaveValue('2016-02-29');
});
