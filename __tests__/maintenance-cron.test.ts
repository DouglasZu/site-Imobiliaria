import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCronSecret: vi.fn(),
  getR2Env: vi.fn(),
  retryNotifications: vi.fn(),
  findDueKeys: vi.fn(),
  attemptTasks: vi.fn(),
  attemptUploads: vi.fn(),
  logServerError: vi.fn(),
  ServiceConfigurationError: class ServiceConfigurationError extends Error {},
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getCronSecret: mocks.getCronSecret,
  getR2Env: mocks.getR2Env,
  ServiceConfigurationError: mocks.ServiceConfigurationError,
}));
vi.mock("@/lib/leads/notifications", () => ({
  retryDueLeadNotifications: mocks.retryNotifications,
}));
vi.mock("@/lib/storage/cleanup", () => ({
  findDueStorageCleanupKeys: mocks.findDueKeys,
  attemptStorageCleanup: mocks.attemptTasks,
  attemptPendingUploadCleanup: mocks.attemptUploads,
}));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));

import { GET } from "@/app/api/cron/cleanup-uploads/route";

const secret = "c".repeat(32);

function request(token?: string) {
  return new NextRequest("http://localhost/api/cron/cleanup-uploads", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCronSecret.mockReturnValue(secret);
  mocks.getR2Env.mockReturnValue({ configured: true });
  mocks.retryNotifications.mockResolvedValue({ attempted: 2, sent: 1 });
  mocks.findDueKeys.mockResolvedValue(["properties/property-1/key.png"]);
  mocks.attemptTasks.mockResolvedValue({ attempted: 1, removed: 1 });
  mocks.attemptUploads.mockResolvedValue({ attempted: 3, removed: 2 });
});

describe("maintenance cron", () => {
  it("exige Bearer exato antes de tocar nas filas", async () => {
    const missing = await GET(request());
    const wrong = await GET(request("wrong"));
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(mocks.retryNotifications).not.toHaveBeenCalled();
  });

  it("processa o outbox de leads mesmo com R2 desabilitado", async () => {
    mocks.getR2Env.mockReturnValue(null);
    const response = await GET(request(secret));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        r2Configured: false,
        cleanupTasksAttempted: 0,
        expiredUploadsAttempted: 0,
        leadNotificationsAttempted: 2,
        leadNotificationsSent: 1,
      })
    );
    expect(mocks.findDueKeys).not.toHaveBeenCalled();
  });

  it("limita cada fila R2 a 100 itens e reporta resultados", async () => {
    const response = await GET(request(secret));
    expect(response.status).toBe(200);
    expect(mocks.findDueKeys).toHaveBeenCalledWith(100);
    expect(mocks.attemptUploads).toHaveBeenCalledWith(100);
    expect(await response.json()).toEqual({
      r2Configured: true,
      cleanupTasksAttempted: 1,
      cleanupTasksRemoved: 1,
      expiredUploadsAttempted: 3,
      pendingUploadsRemoved: 2,
      leadNotificationsAttempted: 2,
      leadNotificationsSent: 1,
    });
  });

  it("converte configuração inválida em 503 sem expor detalhes", async () => {
    mocks.getR2Env.mockImplementation(() => {
      throw new mocks.ServiceConfigurationError();
    });
    const response = await GET(request(secret));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Falha na manutenção agendada" });
  });
});
