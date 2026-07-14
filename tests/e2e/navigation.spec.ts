import { test, expect } from "@playwright/test";

test.describe("Lar Imóveis E2E navigation and filters", () => {
  test("should load the homepage with correct brand and header links", async ({ page }) => {
    await page.goto("/");
    
    // Check brand logo in the header
    const brand = page.locator("header").locator("text=LarImóveis").first();
    await expect(brand).toBeVisible();

    // Check stats are loaded (stats section should contain 'Imóveis Disponíveis')
    await expect(page.locator("text=Imóveis Disponíveis").first()).toBeVisible();
    await expect(page.locator("text=Cidades Atendidas").first()).toBeVisible();
  });

  test("should navigate to properties page from homepage", async ({ page }) => {
    await page.goto("/");

    // Click on main Explorer link
    const exploreBtn = page.locator("text=Explorar Imóveis").first();
    await exploreBtn.click();

    // Verify page title is correct on properties page
    await expect(page).toHaveURL(/\/properties/);
    await expect(page.locator("h1")).toContainText("Imóveis Disponíveis");
  });

  test("should apply filters by Rent/Buy", async ({ page }) => {
    await page.goto("/properties");

    // Check segment tabs are present (by using specific button selector)
    const rentTab = page.locator("button:text('Alugar')");
    const buyTab = page.locator("button:text('Comprar')");
    const allTab = page.locator("button:text('Todos os Imóveis')");

    await expect(rentTab).toBeVisible();
    await expect(buyTab).toBeVisible();
    await expect(allTab).toBeVisible();

    // Click on Alugar
    await rentTab.click();
    await expect(page).toHaveURL(/purpose=RENT/);

    // Click on Comprar
    await buyTab.click();
    await expect(page).toHaveURL(/purpose=SALE/);
  });
});
