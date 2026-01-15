import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/$|\/dashboard/);
    
    // Should show dashboard or main page content
    await expect(page.locator('body')).not.toContainText('Login');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[name="username"]', 'invalid');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/invalid|error|failed/i')).toBeVisible();
    
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error for empty fields', async ({ page }) => {
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=/fill|required/i')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/$|\/dashboard/);

    // Find and click logout button (may be in menu)
    const logoutButton = page.locator('text=/logout|sign out/i').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try user menu
      const userMenu = page.locator('[aria-label*="user" i], [aria-label*="menu" i]').first();
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.locator('text=/logout/i').click();
      }
    }

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/shipments');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should persist session after page reload', async ({ page }) => {
    // Login
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/\/$|\/dashboard/);

    // Reload page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL(/\/$|\/dashboard/);
    await expect(page.locator('body')).not.toContainText('Login');
  });
});
