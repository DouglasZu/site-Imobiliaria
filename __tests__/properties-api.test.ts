import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  readJsonBody: vi.fn(),
  validateSameOriginRequest: vi.fn(),
  logServerError: vi.fn(),
  transaction: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/http-security", () => ({
  readJsonBody: mocks.readJsonBody,
  validateSameOriginRequest: mocks.validateSameOriginRequest,
}));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    property: {
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
      findUnique: mocks.findUnique,
      update: mocks.update,
      delete: mocks.delete,
    },
  },
}));

import { GET as listProperties, POST as createProperty } from "@/app/api/properties/route";
import {
  DELETE as deleteProperty,
  GET as getProperty,
  PATCH as patchProperty,
  PUT as updateProperty,
} from "@/app/api/properties/[id]/route";

const validProperty = {
  title: "Apartamento no Centro",
  description: "Apartamento bem localizado, iluminado e pronto para morar.",
  price: 450000,
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
  active: true,
  images: [
    { url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa" },
  ],
};

function request(
  url: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return new NextRequest(url, init);
}

function routeParams(id = "cm123456789") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
    Promise.all(operations)
  );
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.validateSameOriginRequest.mockReturnValue(null);
});

describe("GET /api/properties", () => {
  it("rejeita paginação e parâmetros duplicados antes de consultar o banco", async () => {
    const invalidPage = await listProperties(
      request("http://localhost/api/properties?page=0")
    );
    const duplicate = await listProperties(
      request("http://localhost/api/properties?city=A&city=B")
    );

    expect(invalidPage.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("mantém o filtro de ativos e não envia o operador SQLite inválido mode", async () => {
    await listProperties(
      request("http://localhost/api/properties?city=Paulo&search=centro&limit=20")
    );

    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where.active).toBe(true);
    expect(query.where.city).toEqual({ contains: "Paulo" });
    expect(JSON.stringify(query.where)).not.toContain('"mode"');
    expect(query.take).toBe(20);
    expect(query.include.images.take).toBe(1);
  });

  it("só remove o filtro de ativos para um administrador atual", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });

    await listProperties(
      request("http://localhost/api/properties?active=all")
    );

    expect(mocks.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("mutations /api/properties", () => {
  it("nega criação sem autenticação antes de ler o corpo", async () => {
    const response = await createProperty(
      request("http://localhost/api/properties", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(mocks.readJsonBody).not.toHaveBeenCalled();
  });

  it("cria imagens com ordem determinada pelo servidor", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.readJsonBody.mockResolvedValue({ success: true, data: validProperty });
    mocks.create.mockResolvedValue({ id: "property", ...validProperty });

    const response = await createProperty(
      request("http://localhost/api/properties", { method: "POST" })
    );

    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.images.create).toEqual([
      { url: validProperty.images[0].url, order: 0 },
    ]);
  });

  it("substitui dados e imagens em um único nested write atômico", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.readJsonBody.mockResolvedValue({ success: true, data: validProperty });
    mocks.update.mockResolvedValue({ id: "property", ...validProperty });

    const response = await updateProperty(
      request("http://localhost/api/properties/cm123456789", { method: "PUT" }),
      routeParams()
    );

    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data.images).toEqual({
      deleteMany: {},
      create: [{ url: validProperty.images[0].url, order: 0 }],
    });
  });

  it("aceita PATCH apenas para active e traduz P2025 em 404", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.readJsonBody.mockResolvedValue({ success: true, data: { active: false } });
    mocks.update.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));

    const response = await patchProperty(
      request("http://localhost/api/properties/cm123456789", { method: "PATCH" }),
      routeParams()
    );

    expect(response.status).toBe(404);
  });

  it("valida a mesma origem antes de excluir", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.validateSameOriginRequest.mockReturnValue(
      Response.json({ error: "Origem não permitida" }, { status: 403 })
    );

    const response = await deleteProperty(
      request("http://localhost/api/properties/cm123456789", { method: "DELETE" }),
      routeParams()
    );

    expect(response.status).toBe(403);
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});

describe("GET /api/properties/[id]", () => {
  it("oculta um imóvel inativo de visitantes", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "cm123456789",
      active: false,
      images: [],
    });

    const response = await getProperty(
      request("http://localhost/api/properties/cm123456789"),
      routeParams()
    );

    expect(response.status).toBe(404);
  });
});
