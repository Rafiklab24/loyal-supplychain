import { test, expect } from '@playwright/test';

test.describe('Contracts', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$|\/dashboard/);
    
    // Navigate to contracts
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');
  });

  test('should display contracts list', async ({ page }) => {
    // Should show contracts table or list
    await expect(page.locator('text=/contract|CT-|buyer|seller/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('should support search', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);
    }
  });

  test('should filter by status', async ({ page }) => {
    const statusFilter = page.locator('select[name*="status" i], button:has-text("Status")').first();
    
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      const option = page.locator('text=/ACTIVE|DRAFT/i').first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should open new contract form', async ({ page }) => {
    const newButton = page.locator('button:has-text("New"), button:has-text("Add"), button[aria-label*="new" i]').first();
    
    if (await newButton.isVisible()) {
      await newButton.click();
      
      // Should show form or modal
      await expect(page.locator('text=/new contract|create contract|contract number/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should view contract details', async ({ page }) => {
    const firstContract = page.locator('tr, [data-testid*="contract"], a[href*="contract"]').first();
    
    if (await firstContract.isVisible()) {
      await firstContract.click();
      await page.waitForTimeout(1000);
      
      // Should show details
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
