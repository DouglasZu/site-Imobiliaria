import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResendEnv: vi.fn(),
  send: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getResendEnv: mocks.getResendEnv }));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("resend", () => ({
  Resend: class Resend {
    emails = { send: mocks.send };
  },
}));

import { sendLeadNotification } from "@/lib/email/resend";

const input = {
  leadId: "lead-123",
  name: "Maria",
  email: "maria@example.com",
  phone: null,
  message: "Tenho interesse neste imóvel.",
  propertyId: "property-1",
  propertyTitle: "Apartamento Central",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getResendEnv.mockReturnValue({
    RESEND_API_KEY: "re_test_key_123456",
    EMAIL_FROM: "Lar Imóveis <contato@example.com>",
    CONTACT_EMAIL: "corretor@example.com",
  });
});

afterEach(() => vi.useRealTimers());

describe("sendLeadNotification", () => {
  it("usa apenas destinatário do servidor e chave idempotente", async () => {
    mocks.send.mockResolvedValue({ data: { id: "email-1" }, error: null });
    const result = await sendLeadNotification(input);

    expect(result).toEqual({ status: "SENT", id: "email-1" });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["corretor@example.com"],
        from: "Lar Imóveis <contato@example.com>",
        replyTo: "maria@example.com",
      }),
      { idempotencyKey: "lead/lead-123" }
    );
  });

  it("fica desabilitado sem credenciais e não chama a rede", async () => {
    mocks.getResendEnv.mockReturnValue(null);
    await expect(sendLeadNotification(input)).resolves.toEqual({ status: "DISABLED" });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("mapeia erro explícito do SDK para FAILED", async () => {
    mocks.send.mockResolvedValue({ data: null, error: { name: "validation_error" } });
    await expect(sendLeadNotification(input)).resolves.toEqual({ status: "FAILED" });
  });

  it("marca timeout como UNKNOWN sem apagar o lead", async () => {
    vi.useFakeTimers();
    mocks.send.mockReturnValue(new Promise(() => undefined));
    const pending = sendLeadNotification(input);
    await vi.advanceTimersByTimeAsync(4_001);
    await expect(pending).resolves.toEqual({ status: "UNKNOWN" });
  });
});
