import { test, expect } from '@playwright/test';
import { createTestAdminUser, deleteTestAdminUser } from './helpers/supabase-helper';

test.describe('WhatsApp Dashboard', () => {
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

  test('should require authentication to access WhatsApp dashboard', async ({ page }) => {
    await page.goto('/');

    // Try to access WhatsApp dashboard
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    // Should show login page
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
  });

  test('should access WhatsApp dashboard after login', async ({ page }) => {
    await page.goto('/');

    // Navigate to login via WhatsApp dashboard link
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    // Login
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    // Should show WhatsApp dashboard
    await expect(page.getByText(/whatsapp|mensajes|messages/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should display messages list or table', async ({ page }) => {
    // Login and navigate to WhatsApp dashboard
    await page.goto('/');
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should show messages table or list
    const messagesElements = page.locator('table, [role="table"], .messages, [class*="message"]');
    await expect(messagesElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have filters or search functionality', async ({ page }) => {
    // Login and navigate
    await page.goto('/');
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should have search or filter inputs
    const searchElements = page.locator('input[type="search"], input[placeholder*="buscar"], input[placeholder*="search"], select, [class*="filter"]');
    await expect(searchElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display message details', async ({ page }) => {
    // Login and navigate
    await page.goto('/');
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should show message content (from, to, status, timestamp, etc.)
    const detailsElements = page.getByText(/de:|from:|para:|to:|estado:|status:|fecha:|date:/i);
    await expect(detailsElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have navigation between dashboards', async ({ page }) => {
    // Login to WhatsApp dashboard
    await page.goto('/');
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should be able to navigate to Ruleta dashboard
    const ruletaDashboardLink = page.getByRole('button', { name: /dashboard.*ruleta|ruleta.*dashboard/i });
    await expect(ruletaDashboardLink).toBeVisible({ timeout: 10000 });

    // Click and verify navigation
    await ruletaDashboardLink.click();
    await expect(page.getByText(/participante|spin|analytics/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should display connection status or stats', async ({ page }) => {
    // Login and navigate
    await page.goto('/');
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should show some stats (total messages, pending, sent, etc.)
    const statsElements = page.getByText(/total|enviado|sent|pendiente|pending|fallido|failed/i);
    await expect(statsElements.first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle empty state gracefully', async ({ page }) => {
    // Login and navigate
    await page.goto('/');
    const whatsappLink = page.getByRole('button', { name: /whatsapp.*dashboard|dashboard.*whatsapp/i });
    if (await whatsappLink.isVisible()) {
      await whatsappLink.click();
    }

    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/email|correo/i).fill(adminCredentials.email);
    await page.getByPlaceholder(/contraseña|password/i).fill(adminCredentials.password);
    await page.getByRole('button', { name: /entrar|login|ingresar/i }).click();

    await page.waitForTimeout(2000);

    // Should either show messages or empty state message
    const content = page.locator('table, .messages, [class*="empty"], [class*="no-data"]');
    await expect(content.first()).toBeVisible({ timeout: 10000 });
  });
});
