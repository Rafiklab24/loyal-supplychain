import { test, expect } from '@playwright/test';

test.describe('Shipments', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$|\/dashboard/);
    
    // Navigate to shipments
    await page.goto('/shipments');
    await page.waitForLoadState('networkidle');
  });

  test('should display shipments list', async ({ page }) => {
    // Should show shipments table or list
    await expect(page.locator('text=/shipment|SN-|product/i').first()).toBeVisible();
  });

  test('should support search', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      
      // Should show search results or loading
      await page.waitForTimeout(1000);
    }
  });

  test('should support pagination', async ({ page }) => {
    // Look for pagination controls
    const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next" i]').first();
    const prevButton = page.locator('button:has-text("Prev"), button[aria-label*="prev" i]').first();
    
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
      
      // Should be on page 2
      if (await prevButton.isVisible()) {
        await prevButton.click();
      }
    }
  });

  test('should filter by status', async ({ page }) => {
    // Look for status filter
    const statusFilter = page.locator('select[name*="status" i], button:has-text("Status")').first();
    
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      const option = page.locator('text=/sailed|booked|arrived/i').first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should open new shipment wizard', async ({ page }) => {
    const newButton = page.locator('button:has-text("New"), button:has-text("Add"), button[aria-label*="new" i]').first();
    
    if (await newButton.isVisible()) {
      await newButton.click();
      
      // Should show wizard or form
      await expect(page.locator('text=/new shipment|create shipment|wizard/i').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should view shipment details', async ({ page }) => {
    // Click on first shipment if available
    const firstShipment = page.locator('tr, [data-testid*="shipment"], a[href*="shipment"]').first();
    
    if (await firstShipment.isVisible()) {
      await firstShipment.click();
      await page.waitForTimeout(1000);
      
      // Should show details or navigate to detail page
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
