import "server-only";

import { sendLeadNotification } from "@/lib/email/resend";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { ADMIN_EVENTS } from "@/lib/realtime/events";
import { publishAdminEvent } from "@/lib/realtime/server";

const NOTIFICATION_RETRY_DELAY_MS = 15 * 60 * 1_000;
const RESEND_IDEMPOTENCY_SAFETY_WINDOW_MS = 23 * 60 * 60 * 1_000;
const MAX_NOTIFICATION_ATTEMPTS = 5;

export async function processLeadNotification(leadId: string) {
  const now = new Date();
  const retryCutoff = new Date(now.getTime() - NOTIFICATION_RETRY_DELAY_MS);
  const unknownCutoff = new Date(
    now.getTime() - RESEND_IDEMPOTENCY_SAFETY_WINDOW_MS
  );
  const claimed = await prisma.lead.updateMany({
    where: {
      id: leadId,
      notificationAttempts: { lt: MAX_NOTIFICATION_ATTEMPTS },
      AND: [
        {
          OR: [
            { notificationStatus: "PENDING", notificationAttempts: 0 },
            {
              notificationStatus: "PENDING",
              notificationAttempts: { gt: 0 },
              createdAt: { gt: unknownCutoff },
            },
            { notificationStatus: "FAILED" },
            { notificationStatus: "UNKNOWN", createdAt: { gt: unknownCutoff } },
          ],
        },
        {
          OR: [
            { notificationAttemptedAt: null },
            { notificationAttemptedAt: { lte: retryCutoff } },
          ],
        },
      ],
    },
    data: {
      notificationAttempts: { increment: 1 },
      notificationAttemptedAt: now,
    },
  });
  if (claimed.count !== 1) return false;

  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return false;
    const notification = await sendLeadNotification({
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      message: lead.message,
      propertyId: lead.propertyId ?? "removed-property",
      propertyTitle: lead.propertyTitle,
    });
    if (notification.status === "DISABLED") {
      // Missing optional credentials are not a delivery attempt. Preserve the
      // outbox item so configuring Resend later makes it eligible again.
      await prisma.lead.updateMany({
        where: { id: lead.id },
        data: {
          notificationStatus: lead.notificationStatus,
          notificationAttempts: { decrement: 1 },
          notificationId: null,
        },
      });
      return false;
    }
    await prisma.lead.updateMany({
      where: { id: lead.id },
      data: {
        notificationStatus: notification.status,
        notificationId: notification.status === "SENT" ? notification.id : null,
      },
    });
    return notification.status === "SENT";
  } catch (error) {
    // The durable PENDING claim becomes eligible again after the retry delay.
    logServerError("leads.notification_processing_failed", error);
    return false;
  }
}

export async function retryDueLeadNotifications(limit = 20) {
  const now = Date.now();
  const retryCutoff = new Date(now - NOTIFICATION_RETRY_DELAY_MS);
  const unknownCutoff = new Date(now - RESEND_IDEMPOTENCY_SAFETY_WINDOW_MS);
  const leads = await prisma.lead.findMany({
    where: {
      notificationAttempts: { lt: MAX_NOTIFICATION_ATTEMPTS },
      AND: [
        {
          OR: [
            { notificationStatus: "PENDING", notificationAttempts: 0 },
            {
              notificationStatus: "PENDING",
              notificationAttempts: { gt: 0 },
              createdAt: { gt: unknownCutoff },
            },
            { notificationStatus: "FAILED" },
            { notificationStatus: "UNKNOWN", createdAt: { gt: unknownCutoff } },
          ],
        },
        {
          OR: [
            { notificationAttemptedAt: null },
            { notificationAttemptedAt: { lte: retryCutoff } },
          ],
        },
      ],
    },
    orderBy: [
      { notificationAttemptedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
    take: Math.min(Math.max(limit, 1), 20),
    select: { id: true },
  });
  const results = await Promise.all(
    leads.map(async (lead) => {
      const sent = await processLeadNotification(lead.id);
      await publishAdminEvent(ADMIN_EVENTS.leadNotificationUpdated, lead.id);
      return sent;
    })
  );
  return {
    attempted: leads.length,
    sent: results.filter(Boolean).length,
  };
}
