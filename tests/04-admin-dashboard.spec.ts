import { test, expect } from '@playwright/test';
import { createTestAdminUser, deleteTestAdminUser } from './helpers/supabase-helper';

test.describe('Admin Dashboard', () => {
  let adminCredentials: { user: any; email: string; password: string };

  test.beforeAll(async () => {
    // Create test admin user
    adminCredentials = await createTestAdminUser(`admin${Date.now()}@test.com`, 'TestPassword123!');
  });

  test.afterAll(async () => {
    // Clean up admin user
    if (adminCredentials?.user) {
      await deleteTestAdminUser(adminCredentials.user.id);
    }
  });

  test('should redirect to login when accessing admin without authentication', async ({ page }) => {
    await page.goto('/');

    // Try to access admin dashboard from navigation
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    } else {
      // Try direct navigation
      await page.evaluate(() => {
        (window as any).location.hash = '#admin';
      });
    }

    // Should show login page
    await expect(page.getByText(/admin|acceso/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible();
    await expect(page.getByPlaceholder(/contraseña|password/i)).toBeVisible();
  });

  test('should reject invalid admin credentials', async ({ page }) => {
    await page.goto('/');

    // Navigate to admin login
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    }

    // Wait for login form
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });

    // Try invalid credentials
    await page.getByPlaceholder(/email|correo/i).fill('invalid@test.com');
    await page.getByPlaceholder(/contraseña|password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    // Should show error
    await expect(page.getByText(/error|inválid|incorrect|wrong/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with valid admin credentials', async ({ page }) => {
    await page.goto('/');

    // Navigate to admin login
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    }

    // Wait for login form
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });

    // Login with test admin
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    // Should show admin dashboard
    await expect(page.getByText(/dashboard|panel|admin/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should display analytics metrics in dashboard', async ({ page }) => {
    // Login first
    await page.goto('/');
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    // Wait for dashboard
    await page.waitForTimeout(2000);

    // Should show metrics (participants, spins, redemptions, etc)
    const metricsTexts = page.getByText(/participante|spin|canje|conversión|total/i);
    await expect(metricsTexts.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display participants table or list', async ({ page }) => {
    // Login
    await page.goto('/');
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should show table headers or list of participants
    const tableElements = page.locator('table, [role="table"], .table, th, [class*="participant"]');
    await expect(tableElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have Analytics AI orb', async ({ page }) => {
    // Login
    await page.goto('/');
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should show Analytics AI orb (floating button)
    const analyticsOrb = page.locator('[class*="fixed"]').filter({ has: page.getByText(/AI|analytics/i) }).or(
      page.locator('button').filter({ has: page.locator('svg[class*="chart"]') })
    );

    await expect(analyticsOrb.first()).toBeVisible({ timeout: 10000 });
  });

  test('should open Analytics AI chat modal', async ({ page }) => {
    // Login
    await page.goto('/');
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Click Analytics AI orb
    const analyticsOrb = page.locator('[class*="fixed"]').filter({ has: page.getByText(/AI|analytics/i) }).or(
      page.locator('button').filter({ has: page.locator('svg[class*="chart"]') })
    );

    await analyticsOrb.first().click({ timeout: 10000 });

    // Should open chat modal
    await expect(page.getByText(/Analytics AI|Asistente/i)).toBeVisible({ timeout: 5000 });
  });

  test('should allow logout', async ({ page }) => {
    // Login
    await page.goto('/');
    const adminLink = page.getByRole('button', { name: /dashboard.*ruleta|admin/i });
    if (await adminLink.isVisible()) {
      await adminLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /salir|logout|cerrar.*sesión/i });
    await logoutButton.click({ timeout: 10000 });

    // Should redirect to home or show login again
    await expect(page.getByText(/bienvenido|inicio|registro/i).first()).toBeVisible({ timeout: 5000 });
  });
});
