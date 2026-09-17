import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL ||
    "https://your-project.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "your-anon-key";
const supabase = createClient(supabaseUrl, supabaseKey);

test.describe("Data Integration", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
    });

    test("should save onboarding preferences to database", async ({ page }) => {
        // 1. Complete Onboarding
        await page.getByRole("button", { name: /INICIAR EXPERIENCIA/i })
            .click();
        await page.getByText("Picantes").click();
        await page.getByRole("button", { name: /CONTINUAR/i }).click();
        await page.getByText("Pareja").click();
        await page.getByRole("button", { name: /FINALIZAR/i }).click();

        // 2. Complete Registration
        await page.getByRole("button", { name: /GIRAR AHORA/i }).click();

        const uniqueId = Date.now();
        const email = `test.preferences.${uniqueId}@example.com`;
        const phone = `+5255${uniqueId.toString().slice(-8)}`;

        await page.getByPlaceholder("Nombre completo").fill("Test Preferences");
        await page.getByPlaceholder("usuario@dominio.com").fill(email);
        await page.getByPlaceholder("Ej. +525512345678").fill(phone);
        await page.getByPlaceholder("dd/mm/aaaa").fill("1990-01-01"); // Assuming date input
        // If date input is text:
        // await page.getByPlaceholder('dd/mm/aaaa').fill('01/01/1990');

        // Handle date input if it's type="date"
        const dateInput = page.locator('input[type="date"]');
        if (await dateInput.count() > 0) {
            await dateInput.fill("1990-01-01");
        }

        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: /REGISTRARME Y GIRAR/i })
            .click();

        // 3. Verify in Database
        // Wait for registration to complete (roulette view appears)
        await expect(page.locator(".roulette-container")).toBeVisible({
            timeout: 10000,
        });

        const { data: participant, error } = await supabase
            .from("participants")
            .select("preferences")
            .eq("email", email)
            .single();

        expect(error).toBeNull();
        expect(participant).not.toBeNull();
        expect(participant?.preferences).toEqual({
            flavors: ["picantes"],
            group: "pareja",
        });
    });
});
