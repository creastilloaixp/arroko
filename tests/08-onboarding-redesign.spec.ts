import { expect, test } from "@playwright/test";

test.describe("Onboarding Redesign (Express)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("should complete the 3-step express onboarding", async ({ page }) => {
        // Step 0: Welcome
        await expect(page.getByText(/TU ANTOJO/i)).toBeVisible();
        await page.getByRole("button", { name: /INICIAR EXPERIENCIA/i })
            .click();

        // Step 1: Flavors
        await expect(page.getByText(/¿Cuál es tu vibe hoy?/i)).toBeVisible();
        // Select a flavor (e.g., Picantes)
        await page.getByText("Picantes").click();
        await page.getByRole("button", { name: /CONTINUAR/i }).click();

        // Step 2: Company
        await expect(page.getByText(/¿Cómo vienes hoy?/i)).toBeVisible();
        // Select company (e.g., Pareja)
        await page.getByText("Pareja").click();
        await page.getByRole("button", { name: /FINALIZAR/i }).click();

        // Verify transition to Exclusive Invite
        await expect(page.getByText(/INVITACIÓN EXCLUSIVA/i)).toBeVisible();
    });
});
