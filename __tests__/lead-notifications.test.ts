import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  sendLeadNotification: vi.fn(),
  publishAdminEvent: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/resend", () => ({
  sendLeadNotification: mocks.sendLeadNotification,
}));
vi.mock("@/lib/logging", () => ({ logServerError: mocks.logServerError }));
vi.mock("@/lib/realtime/server", () => ({
  publishAdminEvent: mocks.publishAdminEvent,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
  },
}));

import {
  processLeadNotification,
  retryDueLeadNotifications,
} from "@/lib/leads/notifications";

const lead = {
  id: "lead-1",
  name: "Maria",
  email: "maria@example.test",
  phone: null,
  message: "Quero visitar este imóvel.",
  propertyId: "property-1",
  propertyTitle: "Apartamento Central",
  notificationStatus: "PENDING",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findUnique.mockResolvedValue(lead);
  mocks.findMany.mockResolvedValue([]);
  mocks.sendLeadNotification.mockResolvedValue({ status: "SENT", id: "email-1" });
});

describe("durable lead notifications", () => {
  it("reivindica o outbox antes de enviar e persiste o resultado", async () => {
    await expect(processLeadNotification(lead.id)).resolves.toBe(true);

    expect(mocks.updateMany.mock.calls[0][0]).toEqual({
      where: expect.objectContaining({
        id: lead.id,
        notificationAttempts: { lt: 5 },
        AND: expect.arrayContaining([
          expect.objectContaining({
            OR: expect.arrayContaining([
              { notificationStatus: "PENDING", notificationAttempts: 0 },
              expect.objectContaining({
                notificationStatus: "PENDING",
                notificationAttempts: { gt: 0 },
                createdAt: { gt: expect.any(Date) },
              }),
              { notificationStatus: "FAILED" },
              expect.objectContaining({ notificationStatus: "UNKNOWN" }),
            ]),
          }),
        ]),
      }),
      data: {
        notificationAttempts: { increment: 1 },
        notificationAttemptedAt: expect.any(Date),
      },
    });
    expect(mocks.sendLeadNotification).toHaveBeenCalledOnce();
    expect(mocks.updateMany.mock.calls[1][0].data).toEqual({
      notificationStatus: "SENT",
      notificationId: "email-1",
    });
  });

  it("não duplica envio quando outra execução já reivindicou o lead", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(processLeadNotification(lead.id)).resolves.toBe(false);
    expect(mocks.sendLeadNotification).not.toHaveBeenCalled();
  });

  it("mantém PENDING sem gastar tentativa quando Resend não está configurado", async () => {
    mocks.sendLeadNotification.mockResolvedValue({ status: "DISABLED" });
    await expect(processLeadNotification(lead.id)).resolves.toBe(false);
    expect(mocks.updateMany.mock.calls[1][0].data).toEqual({
      notificationStatus: "PENDING",
      notificationAttempts: { decrement: 1 },
      notificationId: null,
    });
  });

  it("persiste UNKNOWN para retry idempotente após transporte incerto", async () => {
    mocks.sendLeadNotification.mockResolvedValue({ status: "UNKNOWN" });
    await expect(processLeadNotification(lead.id)).resolves.toBe(false);
    expect(mocks.updateMany.mock.calls[1][0].data.notificationStatus).toBe("UNKNOWN");
  });

  it("limita PENDING já tentado à janela segura de idempotência", async () => {
    await processLeadNotification(lead.id);
    const stateRules = mocks.updateMany.mock.calls[0][0].where.AND[0].OR;
    const retriedPending = stateRules.find(
      (rule: { notificationStatus?: string; notificationAttempts?: unknown }) =>
        rule.notificationStatus === "PENDING" &&
        typeof rule.notificationAttempts === "object"
    );
    expect(retriedPending).toEqual({
      notificationStatus: "PENDING",
      notificationAttempts: { gt: 0 },
      createdAt: { gt: expect.any(Date) },
    });
  });

  it("prioriza itens nunca tentados ao consultar o outbox", async () => {
    await retryDueLeadNotifications();
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { notificationAttemptedAt: { sort: "asc", nulls: "first" } },
          { createdAt: "asc" },
        ],
      })
    );
  });
});
