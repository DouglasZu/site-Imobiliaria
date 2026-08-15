import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  readJsonBody: vi.fn(),
  getPusherServerEnv: vi.fn(),
  trigger: vi.fn(),
  authorizeChannel: vi.fn(),
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
vi.mock("@/lib/env", () => ({
  getPusherServerEnv: mocks.getPusherServerEnv,
  ServiceConfigurationError: class ServiceConfigurationError extends Error {},
}));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("pusher", () => ({
  default: class Pusher {
    trigger = mocks.trigger;
    authorizeChannel = mocks.authorizeChannel;
  },
}));

import { POST as authorize } from "@/app/api/pusher/auth/route";
import { ADMIN_EVENTS } from "@/lib/realtime/events";
import { publishAdminEvent } from "@/lib/realtime/server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentAdmin.mockResolvedValue({ id: "admin-1" });
  mocks.getPusherServerEnv.mockReturnValue({
    PUSHER_APP_ID: "app",
    PUSHER_SECRET: "secret-secret",
    PUSHER_KEY: "key",
    PUSHER_CLUSTER: "sa1",
    NEXT_PUBLIC_PUSHER_KEY: "key",
    NEXT_PUBLIC_PUSHER_CLUSTER: "sa1",
  });
  mocks.trigger.mockResolvedValue({ status: 200 });
  mocks.authorizeChannel.mockReturnValue({ auth: "key:signed" });
});

describe("Pusher server", () => {
  it("não falha a mutação quando a publicação externa falha", async () => {
    mocks.trigger.mockRejectedValue(new Error("network"));
    await expect(publishAdminEvent(ADMIN_EVENTS.propertyCreated, "property-1")).resolves.toBe(
      false
    );
    expect(mocks.logServerError).toHaveBeenCalledOnce();
  });

  it("fica inativo sem credenciais", async () => {
    mocks.getPusherServerEnv.mockReturnValue(null);
    await expect(publishAdminEvent(ADMIN_EVENTS.propertyUpdated, "property-1")).resolves.toBe(
      false
    );
    expect(mocks.trigger).not.toHaveBeenCalled();
  });
});

describe("POST /api/pusher/auth", () => {
  function request() {
    return new NextRequest("http://localhost/api/pusher/auth", { method: "POST" });
  }

  it("rejeita sessão ausente antes do corpo", async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null);
    const response = await authorize(request());
    expect(response.status).toBe(401);
    expect(mocks.readJsonBody).not.toHaveBeenCalled();
  });

  it("autoriza exclusivamente private-admin com socket válido", async () => {
    mocks.readJsonBody.mockResolvedValue({
      success: true,
      data: { socketId: "123.456", channelName: "private-admin" },
    });
    const response = await authorize(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ auth: "key:signed" });
    expect(mocks.authorizeChannel).toHaveBeenCalledWith("123.456", "private-admin");
  });

  it.each([
    { socketId: "not-a-socket", channelName: "private-admin" },
    { socketId: "123.456", channelName: "public-admin" },
    { socketId: "123.456", channelName: "private-other" },
  ])("nega canal ou socket não permitido", async (data) => {
    mocks.readJsonBody.mockResolvedValue({ success: true, data });
    const response = await authorize(request());
    expect(response.status).toBe(403);
    expect(mocks.authorizeChannel).not.toHaveBeenCalled();
  });
});
