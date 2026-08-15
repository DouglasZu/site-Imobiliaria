import { expect, test } from "@playwright/test";

test.describe("security and production behavior", () => {
  test("redirects unauthenticated visitors away from protected admin pages", async ({
    page,
  }) => {
    await page.goto("/admin/properties/new");

    await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/);
    await expect(page.locator("input[type=email]")).toBeVisible();
  });

  test("rejects invalid and duplicated public query parameters", async ({ request }) => {
    const invalidPage = await request.get("/api/properties?page=0");
    const duplicateCity = await request.get(
      "/api/properties?city=Sao%20Paulo&city=Campinas"
    );
    const excessiveLimit = await request.get("/api/properties?limit=999999");

    expect(invalidPage.status()).toBe(400);
    expect(duplicateCity.status()).toBe(400);
    expect(excessiveLimit.status()).toBe(400);
  });

  test("never exposes inactive properties through active=all without a session", async ({
    request,
  }) => {
    const response = await request.get("/api/properties?active=all&limit=50");
    expect(response.ok()).toBe(true);

    const payload = (await response.json()) as {
      properties: Array<{ active: boolean }>;
    };
    expect(payload.properties.length).toBeGreaterThan(0);
    expect(payload.properties.every((property) => property.active)).toBe(true);
  });

  test("authenticates an admin and keeps an inactive multi-image fixture private", async ({
    page,
    playwright,
  }, testInfo) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error(
        "ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórias para o fluxo E2E autenticado."
      );
    }

    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const title = `Imóvel E2E inativo ${testInfo.project.name}`;
    const fixture = {
      title,
      description:
        "Imóvel temporário usado para validar privacidade e edição sem perda de imagens.",
      price: 123456,
      city: "São Paulo",
      neighborhood: "Centro",
      address: null,
      type: "APARTMENT",
      purpose: "SALE",
      bedrooms: 2,
      bathrooms: 1,
      area: 70,
      whatsappPhone: null,
      featured: false,
      active: false,
      images: [
        { url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688" },
        { url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2" },
        { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267" },
      ],
    };

    let propertyId: string | undefined;
    try {
      const created = await page.request.post("/api/properties", {
        headers: { Origin: "http://localhost:3000" },
        data: fixture,
      });
      expect(created.status()).toBe(201);
      propertyId = ((await created.json()) as { id: string }).id;

      const adminList = await page.request.get(
        `/api/properties?active=all&search=${encodeURIComponent(title)}`
      );
      const adminPayload = (await adminList.json()) as {
        properties: Array<{ id: string; active: boolean }>;
      };
      expect(adminPayload.properties).toContainEqual(
        expect.objectContaining({ id: propertyId, active: false })
      );

      const publicRequest = await playwright.request.newContext({
        baseURL: "http://localhost:3000",
      });
      try {
        const publicList = await publicRequest.get(
          `/api/properties?active=all&search=${encodeURIComponent(title)}`
        );
        const publicPayload = (await publicList.json()) as {
          properties: Array<{ id: string }>;
        };
        expect(publicPayload.properties).toEqual([]);
      } finally {
        await publicRequest.dispose();
      }

      await page.goto(`/admin/properties/${propertyId}/edit`);
      await expect(page.getByText("3/12 imagens")).toBeVisible();
      await expect(page.getByAltText("Imagem 3")).toBeVisible();
    } finally {
      if (propertyId) {
        const removed = await page.request.delete(`/api/properties/${propertyId}`, {
          headers: { Origin: "http://localhost:3000" },
        });
        expect(removed.ok()).toBe(true);
      }
    }
  });

  test("protects every property mutation on the server", async ({ request }) => {
    const headers = {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
    };

    const create = await request.post("/api/properties", {
      headers,
      data: {},
    });
    const update = await request.put("/api/properties/cm-does-not-exist", {
      headers,
      data: {},
    });
    const patch = await request.patch("/api/properties/cm-does-not-exist", {
      headers,
      data: { active: false },
    });
    const remove = await request.delete("/api/properties/cm-does-not-exist", {
      headers: { Origin: "http://localhost:3000" },
    });

    expect(create.status()).toBe(401);
    expect(update.status()).toBe(401);
    expect(patch.status()).toBe(401);
    expect(remove.status()).toBe(401);
  });

  test("serves baseline security headers", async ({ request }) => {
    const response = await request.get("/");

    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers()["permissions-policy"]).toBeTruthy();
    if (process.env.PLAYWRIGHT_PRODUCTION) {
      expect(response.headers()["content-security-policy"]).toBeTruthy();
      expect(response.headers()["strict-transport-security"]).toContain(
        "max-age=31536000"
      );
    }
  });
});
