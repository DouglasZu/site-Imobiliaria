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
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  imageCreate: vi.fn(),
  imageDeleteMany: vi.fn(),
  pendingDeleteMany: vi.fn(),
  resolvePropertyImages: vi.fn(),
  queueStorageCleanup: vi.fn(),
  attemptStorageCleanup: vi.fn(),
  publishAdminEvent: vi.fn(),
  scheduleAfterResponse: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/r2", () => ({
  getR2PublicUrl: (storageKey: string) => `https://images.example.test/${storageKey}`,
}));
vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/http-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http-security")>(
    "@/lib/http-security"
  );
  return {
    ...actual,
    readJsonBody: mocks.readJsonBody,
    validateSameOriginRequest: mocks.validateSameOriginRequest,
  };
});
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("@/lib/realtime/server", () => ({ publishAdminEvent: mocks.publishAdminEvent }));
vi.mock("@/lib/post-response", () => ({
  scheduleAfterResponse: mocks.scheduleAfterResponse,
}));
vi.mock("@/lib/storage/cleanup", () => ({
  queueStorageCleanup: mocks.queueStorageCleanup,
  attemptStorageCleanup: mocks.attemptStorageCleanup,
}));
vi.mock("@/lib/storage/property-images", () => ({
  PropertyImageInputError: class PropertyImageInputError extends Error {},
  resolvePropertyImages: mocks.resolvePropertyImages,
}));

const transactionClient = {
  property: {
    create: mocks.create,
    findUnique: mocks.findUnique,
    findUniqueOrThrow: mocks.findUniqueOrThrow,
    update: mocks.update,
    updateMany: mocks.updateMany,
    delete: mocks.delete,
    deleteMany: mocks.deleteMany,
  },
  image: { create: mocks.imageCreate, deleteMany: mocks.imageDeleteMany },
  pendingUpload: { deleteMany: mocks.pendingDeleteMany },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    property: {
      findMany: mocks.findMany,
      count: mocks.count,
      findUnique: mocks.findUnique,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      update: mocks.update,
      updateMany: mocks.updateMany,
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
  images: [{ url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa" }],
};

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

function routeParams(id = "cm123456789") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (input: unknown) =>
    Array.isArray(input)
      ? Promise.all(input)
      : (input as (transaction: typeof transactionClient) => Promise<unknown>)(transactionClient)
  );
  mocks.findMany.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
  mocks.validateSameOriginRequest.mockReturnValue(null);
  mocks.publishAdminEvent.mockResolvedValue(false);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.resolvePropertyImages.mockResolvedValue({
    resolved: [
      {
        url: validProperty.images[0].url,
        storageKey: null,
        contentType: null,
        byteSize: null,
      },
    ],
    pendingUploadIds: [],
  });
  mocks.findUniqueOrThrow.mockResolvedValue({
    id: "property",
    price: "450000.00",
    images: [],
  });
});

describe("GET /api/properties", () => {
  it("rejeita paginação e parâmetros duplicados antes de consultar o banco", async () => {
    const invalidPage = await listProperties(request("http://localhost/api/properties?page=0"));
    const duplicate = await listProperties(
      request("http://localhost/api/properties?city=A&city=B")
    );

    expect(invalidPage.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("usa filtros case-insensitive suportados pelo PostgreSQL", async () => {
    await listProperties(
      request("http://localhost/api/properties?city=Paulo&search=centro&limit=20")
    );

    const query = mocks.findMany.mock.calls[0][0];
    expect(query.where.active).toBe(true);
    expect(query.where.city).toEqual({ contains: "Paulo", mode: "insensitive" });
    expect(query.where.OR[0].title.mode).toBe("insensitive");
    expect(query.take).toBe(20);
    expect(query.include.images.take).toBe(1);
  });

  it("só remove o filtro de ativos para um administrador atual", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    await listProperties(request("http://localhost/api/properties?active=all"));
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

  it("persiste preço decimal e imagens em uma transação", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.readJsonBody.mockResolvedValue({ success: true, data: validProperty });

    const response = await createProperty(
      request("http://localhost/api/properties", { method: "POST" })
    );

    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.price).toBe("450000.00");
    expect(mocks.imageCreate.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ url: validProperty.images[0].url, order: 0 })
    );
    const scheduled = mocks.scheduleAfterResponse.mock.calls[0][0] as () => Promise<void>;
    await scheduled();
    expect(mocks.publishAdminEvent).toHaveBeenCalledOnce();
  });

  it("substitui dados e imagens na mesma transação", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { ...validProperty, version: 1 },
    });
    mocks.findUnique.mockResolvedValue({ id: "cm123456789", version: 1, images: [] });

    const response = await updateProperty(
      request("http://localhost/api/properties/cm123456789", { method: "PUT" }),
      routeParams()
    );

    expect(response.status).toBe(200);
    expect(mocks.imageDeleteMany).toHaveBeenCalledWith({
      where: { propertyId: "cm123456789" },
    });
    expect(mocks.queueStorageCleanup).toHaveBeenCalled();
    const scheduled = mocks.scheduleAfterResponse.mock.calls[0][0] as () => Promise<void>;
    await scheduled();
    expect(mocks.attemptStorageCleanup).toHaveBeenCalled();
  });

  it("aceita PATCH apenas para active+version e devolve 404 quando não existe", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { active: false, version: 1 },
    });
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.count.mockResolvedValue(0);

    const response = await patchProperty(
      request("http://localhost/api/properties/cm123456789", { method: "PATCH" }),
      routeParams()
    );
    expect(response.status).toBe(404);
  });

  it("rejeita uma edição baseada em versão obsoleta", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { ...validProperty, version: 1 },
    });
    mocks.findUnique.mockResolvedValue({ id: "cm123456789", version: 2, images: [] });

    const response = await updateProperty(
      request("http://localhost/api/properties/cm123456789", { method: "PUT" }),
      routeParams()
    );

    expect(response.status).toBe(409);
    expect(mocks.imageDeleteMany).not.toHaveBeenCalled();
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
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("exclui com versionamento e enfileira as keys R2 na mesma transação", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin" });
    const storageKey =
      "properties/cm123456789/00000000-0000-0000-0000-000000000000.png";
    mocks.findUnique.mockResolvedValue({
      id: "cm123456789",
      version: 3,
      images: [{ storageKey }],
    });

    const response = await deleteProperty(
      request("http://localhost/api/properties/cm123456789", {
        method: "DELETE",
        headers: { Origin: "http://localhost", "If-Match": "3" },
      }),
      routeParams()
    );

    expect(response.status).toBe(200);
    expect(mocks.queueStorageCleanup).toHaveBeenCalledWith(transactionClient, [storageKey]);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: "cm123456789", version: 3 },
    });
    const scheduled = mocks.scheduleAfterResponse.mock.calls[0][0] as () => Promise<void>;
    await scheduled();
    expect(mocks.attemptStorageCleanup).toHaveBeenCalledWith([storageKey]);
  });
});

describe("GET /api/properties/[id]", () => {
  it("oculta um imóvel inativo de visitantes", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "cm123456789",
      active: false,
      price: "10.00",
      images: [],
    });

    const response = await getProperty(
      request("http://localhost/api/properties/cm123456789"),
      routeParams()
    );
    expect(response.status).toBe(404);
  });
});
