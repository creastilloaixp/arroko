import { test, expect } from '@playwright/test';
import { createTestParticipant, createTestSpin } from './helpers/supabase-helper';

test.describe('Prize Redemption Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show redemption page when navigating to /redeem', async ({ page }) => {
    await page.goto('/redeem');

    // Should see redemption page
    await expect(page.getByText(/canje|redeem|validar/i).first()).toBeVisible();

    // Should have input for code
    await expect(page.getByPlaceholder(/código|code/i)).toBeVisible();

    // Should have scan QR button
    await expect(page.getByRole('button', { name: /escanear|scan|qr/i })).toBeVisible();
  });

  test('should validate code input', async ({ page }) => {
    await page.goto('/redeem');

    // Try to submit empty code
    const validateButton = page.getByRole('button', { name: /validar|canjear|verify/i });

    // Button should be disabled or prevent submission
    const isDisabled = await validateButton.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('should show error for invalid code', async ({ page }) => {
    await page.goto('/redeem');

    // Enter invalid code
    await page.getByPlaceholder(/código|code/i).fill('invalid-code-123');

    // Submit
    const validateButton = page.getByRole('button', { name: /validar|canjear|verify/i });
    await validateButton.click();

    // Should show error message
    await expect(page.getByText(/inválido|invalid|no encontrado|not found/i)).toBeVisible({ timeout: 10000 });
  });

  test('should redeem valid code successfully', async ({ page }) => {
    // Create a test participant and spin
    const participant = await createTestParticipant(`test${Date.now()}@example.com`);
    const spin = await createTestSpin(participant.id, '1'); // Use first prize

    await page.goto('/redeem');

    // Enter valid code (spin ID)
    await page.getByPlaceholder(/código|code/i).fill(spin.id);

    // Submit
    const validateButton = page.getByRole('button', { name: /validar|canjear|verify/i });
    await validateButton.click();

    // Should show success message
    await expect(page.getByText(/éxito|success|canjeado|redeemed/i)).toBeVisible({ timeout: 10000 });
  });

  test('should prevent redeeming same code twice', async ({ page }) => {
    // Create a test participant and spin
    const participant = await createTestParticipant(`test${Date.now()}@example.com`);
    const spin = await createTestSpin(participant.id, '1');

    await page.goto('/redeem');

    // Redeem first time
    await page.getByPlaceholder(/código|code/i).fill(spin.id);
    const validateButton = page.getByRole('button', { name: /validar|canjear|verify/i });
    await validateButton.click();
    await expect(page.getByText(/éxito|success|canjeado|redeemed/i)).toBeVisible({ timeout: 10000 });

    // Try to redeem again
    await page.goto('/redeem');
    await page.getByPlaceholder(/código|code/i).fill(spin.id);
    await validateButton.click();

    // Should show already redeemed error
    await expect(page.getByText(/ya.*canjead|already.*redeem/i)).toBeVisible({ timeout: 10000 });
  });

  test('should enable QR scanner when clicking scan button', async ({ page }) => {
    await page.goto('/redeem');

    // Click scan QR button
    const scanButton = page.getByRole('button', { name: /escanear|scan|qr/i });
    await scanButton.click();

    // Should show QR scanner UI or request camera permissions
    // We can't actually test camera functionality in headless mode,
    // but we can verify the UI changes
    await expect(page.locator('[id*="qr-reader"], [class*="scanner"], video').first()).toBeVisible({ timeout: 5000 });
  });

  test('should allow canceling QR scan', async ({ page }) => {
    await page.goto('/redeem');

    // Click scan QR button
    const scanButton = page.getByRole('button', { name: /escanear|scan|qr/i });
    await scanButton.click();

    // Wait for scanner to appear
    await page.waitForTimeout(1000);

    // Should have cancel button
    const cancelButton = page.getByRole('button', { name: /cancelar|cancel|cerrar|close/i });
    await cancelButton.click();

    // Should return to normal state
    await expect(page.getByPlaceholder(/código|code/i)).toBeVisible();
  });

  test('should have navigation back to home', async ({ page }) => {
    await page.goto('/redeem');

    // Should have way to navigate back (header logo, back button, etc)
    const homeLinks = page.locator('a[href="/"], button:has-text("Inicio"), button:has-text("Home"), [class*="logo"]');
    await expect(homeLinks.first()).toBeVisible();
  });
});
