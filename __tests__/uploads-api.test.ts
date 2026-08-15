import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  getR2Env: vi.fn(),
  readJsonBody: vi.fn(),
  consumeUploadRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  createPresigned: vi.fn(),
  verify: vi.fn(),
  deleteObject: vi.fn(),
  getPublicUrl: vi.fn(),
  logServerError: vi.fn(),
  ServiceConfigurationError: class ServiceConfigurationError extends Error {},
  InvalidR2ImageError: class InvalidR2ImageError extends Error {},
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/env", () => ({
  getR2Env: mocks.getR2Env,
  ServiceConfigurationError: mocks.ServiceConfigurationError,
}));
vi.mock("@/lib/http-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http-security")>(
    "@/lib/http-security"
  );
  return { ...actual, readJsonBody: mocks.readJsonBody };
});
vi.mock("@/lib/rate-limit", () => ({
  consumeUploadRateLimit: mocks.consumeUploadRateLimit,
  getClientIp: mocks.getClientIp,
}));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("@/lib/storage/r2", () => ({
  createR2PresignedPut: mocks.createPresigned,
  verifyR2Image: mocks.verify,
  deleteR2Object: mocks.deleteObject,
  getR2PublicUrl: mocks.getPublicUrl,
  InvalidR2ImageError: mocks.InvalidR2ImageError,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pendingUpload: {
      count: mocks.count,
      create: mocks.create,
      deleteMany: mocks.deleteMany,
      findFirst: mocks.findFirst,
      findUnique: mocks.findUnique,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
  },
}));

import { POST as presign } from "@/app/api/uploads/presign/route";
import { POST as confirm } from "@/app/api/uploads/confirm/route";
import { DELETE as cancelUpload } from "@/app/api/uploads/[uploadId]/route";

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, { method: "POST" });
}

function deleteRequest() {
  return new NextRequest("http://localhost/api/uploads/upload-1", {
    method: "DELETE",
    headers: { Origin: "http://localhost" },
  });
}

function uploadParams() {
  return { params: Promise.resolve({ uploadId: "upload-1" }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1" });
  mocks.getR2Env.mockReturnValue({ configured: true });
  mocks.consumeUploadRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.getClientIp.mockReturnValue("192.0.2.1");
  mocks.count.mockResolvedValue(0);
  mocks.create.mockResolvedValue({});
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.createPresigned.mockResolvedValue({
    uploadUrl: "https://account.r2.cloudflarestorage.com/signed",
    headers: { "Content-Type": "image/png" },
    expiresAt: new Date("2026-08-15T18:00:00Z"),
  });
  mocks.getPublicUrl.mockReturnValue("https://images.example.com/properties/x/image.png");
});

describe("POST /api/uploads/presign", () => {
  it("exige admin antes de ler o corpo", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    const response = await presign(request("/api/uploads/presign"));
    expect(response.status).toBe(401);
    expect(mocks.readJsonBody).not.toHaveBeenCalled();
  });

  it("rejeita SVG antes de gerar chave", async () => {
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { propertyId: "property-1", contentType: "image/svg+xml", size: 100 },
    });
    const response = await presign(request("/api/uploads/presign"));
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("gera chave independente do nome e não devolve segredo", async () => {
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { propertyId: "property-1", contentType: "image/png", size: 100 },
    });
    const response = await presign(request("/api/uploads/presign"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.create.mock.calls[0][0].data.storageKey).toMatch(
      /^properties\/property-1\/[0-9a-f-]{36}\.png$/
    );
    expect(JSON.stringify(payload)).not.toContain("R2_SECRET_ACCESS_KEY");
  });

  it("remove a intenção se a assinatura falhar", async () => {
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { propertyId: "property-1", contentType: "image/png", size: 100 },
    });
    mocks.createPresigned.mockRejectedValue(new Error("sign failed"));
    const response = await presign(request("/api/uploads/presign"));
    expect(response.status).toBe(500);
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
  });
});

describe("POST /api/uploads/confirm", () => {
  it("confirma somente upload pertencente ao admin", async () => {
    mocks.readJsonBody.mockResolvedValue({ success: true, data: { uploadId: "upload-1" } });
    mocks.findFirst.mockResolvedValue({
      id: "upload-1",
      adminId: "admin-1",
      propertyId: "property-1",
      storageKey: "properties/property-1/00000000-0000-0000-0000-000000000000.png",
      contentType: "image/png",
      byteSize: 100,
      confirmedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await confirm(request("/api/uploads/confirm"));
    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.updateMany).toHaveBeenCalledOnce();
  });

  it("apaga arquivo cuja assinatura real é inválida", async () => {
    mocks.readJsonBody.mockResolvedValue({ success: true, data: { uploadId: "upload-1" } });
    mocks.findFirst.mockResolvedValue({
      id: "upload-1",
      adminId: "admin-1",
      propertyId: "property-1",
      storageKey: "properties/property-1/00000000-0000-0000-0000-000000000000.png",
      contentType: "image/png",
      byteSize: 100,
      confirmedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.verify.mockRejectedValue(new mocks.InvalidR2ImageError());
    const response = await confirm(request("/api/uploads/confirm"));
    expect(response.status).toBe(400);
    expect(mocks.deleteObject).toHaveBeenCalledOnce();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "upload-1", adminId: "admin-1", consumedAt: null },
      data: { confirmedAt: null, cancelledAt: expect.any(Date) },
    });
  });
});

describe("DELETE /api/uploads/[uploadId]", () => {
  it("exige admin antes de consultar a intenção", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    const response = await cancelUpload(deleteRequest(), uploadParams());
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("não revela upload pertencente a outro admin", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await cancelUpload(deleteRequest(), uploadParams());
    expect(response.status).toBe(404);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("reivindica o cancelamento antes de apagar o objeto", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "upload-1",
      adminId: "admin-1",
      storageKey: "properties/property-1/00000000-0000-0000-0000-000000000000.png",
    });
    const response = await cancelUpload(deleteRequest(), uploadParams());
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "upload-1",
        adminId: "admin-1",
        consumedAt: null,
        cancelledAt: null,
      },
      data: { confirmedAt: null, cancelledAt: expect.any(Date) },
    });
    expect(mocks.deleteObject).toHaveBeenCalledOnce();
  });
});
