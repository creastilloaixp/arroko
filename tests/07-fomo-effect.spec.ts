import { expect, test } from "@playwright/test";

test.describe("FOMO Effect Flow", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("should show Exclusive Invite screen after onboarding", async ({ page }) => {
        // 1. Complete onboarding
        const continueButton = page.getByRole("button", {
            name: /continuar|comenzar|empezar/i,
        });
        if (await continueButton.isVisible()) {
            await continueButton.click();
        }

        // 2. Verify Exclusive Invite screen appears
        await expect(page.getByText(/INVITACIÓN EXCLUSIVA|TU OPORTUNIDAD/i))
            .toBeVisible();
        await expect(page.getByText(/oferta expira/i)).toBeVisible();

        // 3. Click "Reclamar Acceso"
        await page.getByRole("button", { name: /reclamar acceso/i }).click();

        // 4. Verify Registration form appears
        await expect(page.getByText(/REGISTRO|REGISTRARME/i)).toBeVisible();
    });
});
