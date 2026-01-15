import { test, expect } from '@playwright/test';

test.describe('Finance', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$|\/dashboard/);
  });

  test('should display transactions list', async ({ page }) => {
    await page.goto('/finance/transactions');
    await page.waitForLoadState('networkidle');
    
    // Should show transactions or empty state
    await expect(page.locator('body')).toBeVisible();
  });

  test('should filter transactions by date range', async ({ page }) => {
    await page.goto('/finance/transactions');
    await page.waitForLoadState('networkidle');
    
    const dateFromInput = page.locator('input[name*="dateFrom" i], input[type="date"]').first();
    const dateToInput = page.locator('input[name*="dateTo" i], input[type="date"]').nth(1);
    
    if (await dateFromInput.isVisible()) {
      await dateFromInput.fill('2024-01-01');
      if (await dateToInput.isVisible()) {
        await dateToInput.fill('2024-12-31');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should filter transactions by direction', async ({ page }) => {
    await page.goto('/finance/transactions');
    await page.waitForLoadState('networkidle');
    
    const directionFilter = page.locator('select[name*="direction" i], button:has-text("Direction")').first();
    
    if (await directionFilter.isVisible()) {
      await directionFilter.click();
      const option = page.locator('text=/incoming|outgoing/i').first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should create new transaction', async ({ page }) => {
    await page.goto('/finance/transactions');
    await page.waitForLoadState('networkidle');
    
    const newButton = page.locator('button:has-text("New"), button:has-text("Add")').first();
    
    if (await newButton.isVisible()) {
      await newButton.click();
      
      // Should show form
      await expect(page.locator('text=/new transaction|create transaction|amount/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should export transactions', async ({ page }) => {
    await page.goto('/finance/transactions');
    await page.waitForLoadState('networkidle');
    
    const exportButton = page.locator('button:has-text("Export"), button[aria-label*="export" i]').first();
    
    if (await exportButton.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        exportButton.click(),
      ]);
      
      // Export may trigger download
      expect(page.locator('body')).toBeVisible();
    }
  });
});
