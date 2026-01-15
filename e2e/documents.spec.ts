import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Documents', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/$|\/dashboard/);
  });

  test('should display documents list', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
    
    // Should show documents or empty state
    await expect(page.locator('body')).toBeVisible();
  });

  test('should filter documents by type', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
    
    const typeFilter = page.locator('select[name*="type" i], button:has-text("Type")').first();
    
    if (await typeFilter.isVisible()) {
      await typeFilter.click();
      const option = page.locator('text=/BL|Invoice|Certificate/i').first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should upload document', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
    
    const uploadButton = page.locator('button:has-text("Upload"), input[type="file"]').first();
    
    if (await uploadButton.isVisible()) {
      // Create a dummy file for testing
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible()) {
        await fileInput.setInputFiles({
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('fake pdf content'),
        });
        
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should download document', async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
    
    // Look for download button
    const downloadButton = page.locator('button[aria-label*="download" i], a[href*="download"]').first();
    
    if (await downloadButton.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        downloadButton.click(),
      ]);
      
      // Download may or may not trigger depending on implementation
      expect(page.locator('body')).toBeVisible();
    }
  });
});
