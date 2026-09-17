import { test, expect } from '@playwright/test';

test.describe('Roulette Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Complete registration first
    const continueButton = page.getByRole('button', { name: /continuar|comenzar|empezar/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }

    const timestamp = Date.now();
    await page.getByPlaceholder(/nombre|name/i).fill(`Test User ${timestamp}`);
    await page.getByPlaceholder(/email|correo/i).fill(`test${timestamp}@example.com`);
    await page.getByPlaceholder(/teléfono|phone/i).fill('5512345678');

    const birthDateField = page.locator('input[type="date"]');
    if (await birthDateField.isVisible()) {
      await birthDateField.fill('1990-01-01');
    }

    const submitButton = page.getByRole('button', { name: /participar|registr|enviar/i });
    await submitButton.click();

    // Wait for roulette to load
    await expect(page.getByText(/RULETA|GIRA/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display roulette wheel', async ({ page }) => {
    // Should see the roulette
    await expect(page.locator('canvas, svg, .roulette, [class*="wheel"]').first()).toBeVisible();

    // Should see spin button
    await expect(page.getByRole('button', { name: /girar|spin|participar/i })).toBeVisible();
  });

  test('should spin the roulette and show result', async ({ page }) => {
    // Click spin button
    const spinButton = page.getByRole('button', { name: /girar|spin|participar/i });
    await spinButton.click();

    // Wait for animation (adjust timeout as needed)
    await page.waitForTimeout(5000);

    // Should show winner page or result
    await expect(page.getByText(/felicidades|ganaste|premio|winner/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('should show prize details after spin', async ({ page }) => {
    // Click spin button
    const spinButton = page.getByRole('button', { name: /girar|spin|participar/i });
    await spinButton.click();

    // Wait for result
    await page.waitForTimeout(5000);
    await expect(page.getByText(/felicidades|ganaste|premio|winner/i).first()).toBeVisible({ timeout: 15000 });

    // Should show prize information
    // Prize name, emoji/icon, and next steps should be visible
    await expect(page.locator('text=/🍱|🍣|🍷|🎁/').first()).toBeVisible();
  });

  test('should display QR code after winning', async ({ page }) => {
    // Click spin button
    const spinButton = page.getByRole('button', { name: /girar|spin|participar/i });
    await spinButton.click();

    // Wait for result
    await page.waitForTimeout(5000);
    await expect(page.getByText(/felicidades|ganaste|premio|winner/i).first()).toBeVisible({ timeout: 15000 });

    // Should show QR code
    await expect(page.locator('canvas, svg, img').filter({ has: page.locator('[class*="qr"]') }).or(page.locator('[id*="qr"]')).first()).toBeVisible({ timeout: 5000 });
  });

  test('should have canjear/redeem button after winning', async ({ page }) => {
    // Click spin button
    const spinButton = page.getByRole('button', { name: /girar|spin|participar/i });
    await spinButton.click();

    // Wait for result
    await page.waitForTimeout(5000);
    await expect(page.getByText(/felicidades|ganaste|premio|winner/i).first()).toBeVisible({ timeout: 15000 });

    // Should have action buttons (canjear, volver, etc)
    const actionButtons = page.getByRole('button').filter({ hasText: /canjear|redeem|volver|inicio/i });
    await expect(actionButtons.first()).toBeVisible();
  });

  test('should prevent multiple spins for same user', async ({ page }) => {
    // First spin
    const spinButton = page.getByRole('button', { name: /girar|spin|participar/i });
    await spinButton.click();

    // Wait for result
    await page.waitForTimeout(5000);
    await expect(page.getByText(/felicidades|ganaste|premio|winner/i).first()).toBeVisible({ timeout: 15000 });

    // Try to go back to roulette
    await page.goto('/');

    // Should not show roulette again, or spin button should be disabled
    const newSpinButton = page.getByRole('button', { name: /girar|spin|participar/i });

    // Either button doesn't exist, is disabled, or we're redirected
    const isButtonDisabled = await newSpinButton.isDisabled().catch(() => true);
    const isButtonHidden = !(await newSpinButton.isVisible().catch(() => false));

    expect(isButtonDisabled || isButtonHidden).toBeTruthy();
  });
});
