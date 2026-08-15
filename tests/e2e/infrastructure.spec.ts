import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function isolateRateLimitIdentity(page: Page): Promise<string> {
  const runId = randomUUID();
  const ipSuffix = runId.replaceAll("-", "").slice(0, 8);

  await page.setExtraHTTPHeaders({
    "x-vercel-forwarded-for": `2001:db8:${ipSuffix.slice(0, 4)}:${ipSuffix.slice(4)}::1`,
  });

  return runId;
}

test.describe("production integrations UI", () => {
  test("persists an interest lead and confirms the UI response", async ({
    page,
  }, testInfo) => {
    const runId = await isolateRateLimitIdentity(page);

    await page.goto("/properties");
    const firstProperty = page.locator('a[href^="/properties/"]').first();
    await expect(firstProperty).toBeVisible();
    await firstProperty.click();

    const form = page
      .getByRole("heading", { name: "Tenho interesse" })
      .locator("xpath=ancestor::section");
    await form.getByLabel("Nome").fill(`Contato E2E ${runId.slice(0, 8)}`);
    await form
      .getByLabel("E-mail")
      .fill(`lead-${testInfo.project.name}-${runId}@example.test`);
    await form.getByRole("button", { name: "Enviar interesse" }).click();
    await expect(form.getByText("Contato recebido.")).toBeVisible();
  });

  test("uploads through the presign/PUT/confirm UI contract", async ({ page }, testInfo) => {
    const runId = await isolateRateLimitIdentity(page);
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) throw new Error("Credenciais E2E administrativas ausentes.");

    await page.route("**/api/uploads/presign", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          uploadId: `upload-${testInfo.project.name}-${runId}`,
          uploadUrl: "http://localhost:3000/test-r2-upload",
          headers: { "Content-Type": "image/png" },
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      });
    });
    await page.route("**/test-r2-upload", async (route) => {
      await route.fulfill({ status: 200, headers: { ETag: '"test"' } });
    });
    await page.route("**/api/uploads/confirm", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          image: {
            uploadId: `upload-${testInfo.project.name}-${runId}`,
            url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa",
          },
        }),
      });
    });

    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/properties/new");

    await page.locator("#imageFiles").setInputFiles({
      name: "house.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });

    await expect(page.getByText("1/12 imagens")).toBeVisible();
    await expect(page.getByAltText("Imagem 1")).toBeVisible();
  });
});
