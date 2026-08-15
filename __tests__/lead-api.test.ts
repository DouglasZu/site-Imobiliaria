import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  readJsonBody: vi.fn(),
  consumeLeadRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  processLeadNotification: vi.fn(),
  scheduleAfterResponse: vi.fn(),
  publishAdminEvent: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentAdmin: mocks.getCurrentAdmin }));
vi.mock("@/lib/http-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http-security")>(
    "@/lib/http-security"
  );
  return { ...actual, readJsonBody: mocks.readJsonBody };
});
vi.mock("@/lib/rate-limit", () => ({
  consumeLeadRateLimit: mocks.consumeLeadRateLimit,
  getClientIp: mocks.getClientIp,
}));
vi.mock("@/lib/leads/notifications", () => ({
  processLeadNotification: mocks.processLeadNotification,
}));
vi.mock("@/lib/post-response", () => ({
  scheduleAfterResponse: mocks.scheduleAfterResponse,
}));
vi.mock("@/lib/realtime/server", () => ({ publishAdminEvent: mocks.publishAdminEvent }));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    property: { findFirst: mocks.findFirst },
    lead: {
      create: mocks.create,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      count: mocks.count,
    },
  },
}));

import { GET, POST } from "@/app/api/leads/route";

const validLead = {
  requestId: "00000000-0000-4000-8000-000000000001",
  propertyId: "property-1",
  name: "Maria Silva",
  email: "MARIA@example.com",
  phone: "+55 11 99999-9999",
  message: "Gostaria de agendar uma visita ao imóvel.",
  website: "",
};

function request(url = "http://localhost/api/leads", method = "POST") {
  return new NextRequest(url, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue(null);
  mocks.getClientIp.mockReturnValue("192.0.2.1");
  mocks.consumeLeadRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.findFirst.mockResolvedValue({ id: "property-1", title: "Apartamento Central" });
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue({
    id: "lead-1",
    name: "Maria Silva",
    email: "maria@example.com",
    phone: "+55 11 99999-9999",
    message: validLead.message,
  });
  mocks.processLeadNotification.mockResolvedValue(true);
  mocks.publishAdminEvent.mockResolvedValue(false);
  mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
    Promise.all(operations)
  );
});

describe("POST /api/leads", () => {
  it("persiste antes de agendar Resend e Pusher fora da resposta", async () => {
    mocks.readJsonBody.mockResolvedValue({ success: true, data: validLead });
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: validLead.requestId,
        email: "maria@example.com",
        propertyTitle: "Apartamento Central",
      }),
    });
    expect(mocks.scheduleAfterResponse).toHaveBeenCalledOnce();
    const scheduled = mocks.scheduleAfterResponse.mock.calls[0][0] as () => Promise<void>;
    await scheduled();
    expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.processLeadNotification.mock.invocationCallOrder[0]
    );
    expect(mocks.publishAdminEvent).toHaveBeenCalledOnce();
  });

  it("trata retry com o mesmo requestId como sucesso idempotente", async () => {
    mocks.readJsonBody.mockResolvedValue({ success: true, data: validLead });
    mocks.findUnique.mockResolvedValue({ id: "lead-1" });
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.consumeLeadRateLimit).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.scheduleAfterResponse).not.toHaveBeenCalled();
  });

  it("rejeita mass assignment de destinatário", async () => {
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { ...validLead, to: "attacker@example.com" },
    });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("trata honeypot como sucesso sem persistir", async () => {
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { ...validLead, website: "https://spam.example" },
    });
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("aplica rate limit com Retry-After", async () => {
    mocks.readJsonBody.mockResolvedValue({ success: true, data: validLead });
    mocks.consumeLeadRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("não aceita lead para imóvel ausente ou inativo", async () => {
    mocks.readJsonBody.mockResolvedValue({ success: true, data: validLead });
    mocks.findFirst.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/leads", () => {
  it("é administrativo e nunca lista contatos sem sessão", async () => {
    const response = await GET(request("http://localhost/api/leads", "GET"));
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("usa desempate único para paginação determinística", async () => {
    mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1" });
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    const response = await GET(request("http://localhost/api/leads?limit=20", "GET"));
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    );
  });
});
