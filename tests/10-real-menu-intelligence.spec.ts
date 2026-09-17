import { expect, test } from "@playwright/test";

test.describe("Real Menu Intelligence", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("http://localhost:5173");
    });

    test("Sommelier should use real menu data for recommendations", async ({ page }) => {
        // Complete onboarding
        await page.click('button:has-text("Comenzar")');
        await page.click('[data-flavor="Picante"]');
        await page.click('button:has-text("Siguiente")');
        await page.click('[data-group="Pareja"]');
        await page.click('button:has-text("Siguiente")');

        // Register
        await page.fill('input[name="fullName"]', "Test Menu User");
        await page.fill('input[name="email"]', "menu@test.com");
        await page.fill('input[name="phone"]', "+1234567890");
        await page.fill('input[name="birthDate"]', "1990-01-01");
        await page.check('input[type="checkbox"]');
        await page.click('button[type="submit"]');

        // Wait for registration to complete
        await page.waitForTimeout(2000);

        // Open Sommelier
        const sommelierButton = page.locator('button:has-text("Sommelier")');
        await sommelierButton.click();

        // Wait for modal
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

        // Ask about menu
        const input = page.locator('textarea, input[type="text"]').last();
        await input.fill("¿Qué rolls tienen?");
        await page.keyboard.press("Enter");

        // Wait for response
        await page.waitForTimeout(3000);

        // Verify response contains real menu items
        const messages = await page.locator('[class*="message"]')
            .allTextContents();
        const responseText = messages.join(" ");

        // Should mention real rolls from our menu
        const hasRealRolls = responseText.includes("Dragon Roll") ||
            responseText.includes("Spicy Tuna") ||
            responseText.includes("IKU Especial") ||
            responseText.includes("Veggie Roll");

        expect(hasRealRolls).toBeTruthy();

        // Should NOT contain generic/hallucinated items
        expect(responseText.toLowerCase()).not.toContain("california roll");
        expect(responseText.toLowerCase()).not.toContain("philadelphia roll");
    });

    test("Sommelier should provide exact prices from database", async ({ page }) => {
        // Complete onboarding and registration (same as above)
        await page.click('button:has-text("Comenzar")');
        await page.click('[data-flavor="Picante"]');
        await page.click('button:has-text("Siguiente")');
        await page.click('[data-group="Pareja"]');
        await page.click('button:has-text("Siguiente")');

        await page.fill('input[name="fullName"]', "Test Price User");
        await page.fill('input[name="email"]', "price@test.com");
        await page.fill('input[name="phone"]', "+1234567891");
        await page.fill('input[name="birthDate"]', "1990-01-01");
        await page.check('input[type="checkbox"]');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        const sommelierButton = page.locator('button:has-text("Sommelier")');
        await sommelierButton.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

        // Ask about price
        const input = page.locator('textarea, input[type="text"]').last();
        await input.fill("¿Cuánto cuesta la cerveza Sapporo?");
        await page.keyboard.press("Enter");

        await page.waitForTimeout(3000);

        const messages = await page.locator('[class*="message"]')
            .allTextContents();
        const responseText = messages.join(" ");

        // Should mention the exact price from database ($95)
        expect(responseText).toMatch(/95|noventa y cinco/i);
    });

    test("Sommelier should use menu data for personalized recommendations", async ({ page }) => {
        // Complete onboarding with specific preferences
        await page.click('button:has-text("Comenzar")');
        await page.click('[data-flavor="Picante"]');
        await page.click('button:has-text("Siguiente")');
        await page.click('[data-group="Pareja"]');
        await page.click('button:has-text("Siguiente")');

        await page.fill('input[name="fullName"]', "Test Recommendation User");
        await page.fill('input[name="email"]', "recommend@test.com");
        await page.fill('input[name="phone"]', "+1234567892");
        await page.fill('input[name="birthDate"]', "1990-01-01");
        await page.check('input[type="checkbox"]');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        const sommelierButton = page.locator('button:has-text("Sommelier")');
        await sommelierButton.click();
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

        // Ask for recommendation
        const input = page.locator('textarea, input[type="text"]').last();
        await input.fill("¿Qué me recomiendas para una pareja?");
        await page.keyboard.press("Enter");

        await page.waitForTimeout(3000);

        const messages = await page.locator('[class*="message"]')
            .allTextContents();
        const responseText = messages.join(" ");

        // Should recommend actual menu items
        const hasRealItems = responseText.includes("Dragon") ||
            responseText.includes("Spicy Tuna") ||
            responseText.includes("IKU Especial") ||
            responseText.includes("Nigiri") ||
            responseText.includes("Sake");

        expect(hasRealItems).toBeTruthy();
    });
});
