import { test, expect } from '@playwright/test';
import { cleanupTestData } from './helpers/supabase-helper';

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.afterAll(async () => {
    // Clean up test data after all tests
    await cleanupTestData();
  });

  test('should show onboarding screen on first visit', async ({ page }) => {
    // Verify onboarding content is visible
    await expect(page.getByText(/BIENVENIDO/i)).toBeVisible();

    // Should have a CTA button to continue
    const continueButton = page.getByRole('button', { name: /continuar|comenzar|empezar/i });
    await expect(continueButton).toBeVisible();
  });

  test('should navigate from onboarding to registration', async ({ page }) => {
    // Click the continue button on onboarding
    const continueButton = page.getByRole('button', { name: /continuar|comenzar|empezar/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }

    // Should now be on registration page
    await expect(page.getByText(/REGISTRO|REGISTR/i).first()).toBeVisible();

    // Should have form fields
    await expect(page.getByPlaceholder(/nombre|name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible();
    await expect(page.getByPlaceholder(/teléfono|phone/i)).toBeVisible();
  });

  test('should complete registration successfully', async ({ page }) => {
    // Navigate to registration if needed
    const continueButton = page.getByRole('button', { name: /continuar|comenzar|empezar/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }

    // Fill out registration form
    const timestamp = Date.now();
    await page.getByPlaceholder(/nombre|name/i).fill(`Test User ${timestamp}`);
    await page.getByPlaceholder(/email|correo/i).fill(`test${timestamp}@example.com`);
    await page.getByPlaceholder(/teléfono|phone/i).fill('5512345678');

    // Fill birth date if present
    const birthDateField = page.locator('input[type="date"]');
    if (await birthDateField.isVisible()) {
      await birthDateField.fill('1990-01-01');
    }

    // Submit form
    const submitButton = page.getByRole('button', { name: /participar|registr|enviar/i });
    await submitButton.click();

    // Should redirect to roulette page
    await expect(page.getByText(/RULETA|GIRA/i)).toBeVisible({ timeout: 10000 });
  });

  test('should validate required fields', async ({ page }) => {
    // Navigate to registration if needed
    const continueButton = page.getByRole('button', { name: /continuar|comenzar|empezar/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }

    // Try to submit without filling fields
    const submitButton = page.getByRole('button', { name: /participar|registr|enviar/i });
    await submitButton.click();

    // Should show validation errors or prevent submission
    // The form might use HTML5 validation, so we check if we're still on the same page
    await expect(page.getByPlaceholder(/nombre|name/i)).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    // Navigate to registration if needed
    const continueButton = page.getByRole('button', { name: /continuar|comenzar|empezar/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }

    // Fill with invalid email
    await page.getByPlaceholder(/nombre|name/i).fill('Test User');
    await page.getByPlaceholder(/email|correo/i).fill('invalid-email');
    await page.getByPlaceholder(/teléfono|phone/i).fill('5512345678');

    const submitButton = page.getByRole('button', { name: /participar|registr|enviar/i });
    await submitButton.click();

    // Should show validation error or prevent submission
    await expect(page.getByPlaceholder(/email|correo/i)).toBeVisible();
  });

  test('should validate phone number format', async ({ page }) => {
    // Navigate to registration if needed
    const continueButton = page.getByRole('button', { name: /continuar|comenzar|empezar/i });
    if (await continueButton.isVisible()) {
      await continueButton.click();
    }

    // Fill with invalid phone
    const timestamp = Date.now();
    await page.getByPlaceholder(/nombre|name/i).fill('Test User');
    await page.getByPlaceholder(/email|correo/i).fill(`test${timestamp}@example.com`);
    await page.getByPlaceholder(/teléfono|phone/i).fill('123'); // Too short

    const submitButton = page.getByRole('button', { name: /participar|registr|enviar/i });
    await submitButton.click();

    // Should show validation error or prevent submission
    await expect(page.getByPlaceholder(/teléfono|phone/i)).toBeVisible();
  });
});
