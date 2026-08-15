import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { jsonNoStore, readJsonBody } from "@/lib/http-security";
import { processLeadNotification } from "@/lib/leads/notifications";
import { logServerError } from "@/lib/logging";
import { scheduleAfterResponse } from "@/lib/post-response";
import { prisma } from "@/lib/prisma";
import { ADMIN_EVENTS } from "@/lib/realtime/events";
import { publishAdminEvent } from "@/lib/realtime/server";
import { consumeLeadRateLimit, getClientIp } from "@/lib/rate-limit";
import { leadSchema } from "@/lib/schemas/lead";

const leadQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(5),
    status: z.enum(["NEW", "CONTACTED", "ARCHIVED"]).optional(),
  })
  .strict();

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  if (!(await getCurrentAdmin())) {
    return jsonNoStore({ error: "Não autorizado" }, { status: 401 });
  }

  const input: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    const current = input[key];
    input[key] = current === undefined ? value : ([] as string[]).concat(current, value);
  }
  const parsed = leadQuerySchema.safeParse(input);
  if (!parsed.success) return jsonNoStore({ error: "Filtros inválidos" }, { status: 400 });

  try {
    const where = parsed.data.status ? { status: parsed.data.status } : {};
    const [leads, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (parsed.data.page - 1) * parsed.data.limit,
        take: parsed.data.limit,
      }),
      prisma.lead.count({ where }),
    ]);
    return jsonNoStore({
      leads,
      pagination: {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total,
        totalPages: Math.ceil(total / parsed.data.limit),
      },
    });
  } catch (error) {
    logServerError("leads.list_failed", error);
    return jsonNoStore({ error: "Não foi possível buscar contatos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request, 8 * 1_024);
    if (!body.success) return body.response;
    const parsed = leadSchema.safeParse(body.data);
    if (!parsed.success) {
      return jsonNoStore(
        { error: parsed.error.issues[0]?.message ?? "Dados de contato inválidos" },
        { status: 400 }
      );
    }

    if (parsed.data.website) {
      return jsonNoStore({ success: true, message: "Contato recebido." }, { status: 201 });
    }

    const existingLead = await prisma.lead.findUnique({
      where: { requestId: parsed.data.requestId },
      select: { id: true },
    });
    if (existingLead) {
      return jsonNoStore({ success: true, message: "Contato recebido." });
    }

    const rateLimit = await consumeLeadRateLimit({
      ip: getClientIp(request),
      email: parsed.data.email,
    });
    if (!rateLimit.allowed) {
      return jsonNoStore(
        { error: "Muitas mensagens. Tente novamente mais tarde." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      );
    }

    const property = await prisma.property.findFirst({
      where: { id: parsed.data.propertyId, active: true },
      select: { id: true, title: true },
    });
    if (!property) {
      return jsonNoStore({ error: "Imóvel não encontrado" }, { status: 404 });
    }

    try {
      const lead = await prisma.lead.create({
        data: {
          requestId: parsed.data.requestId,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          message: parsed.data.message,
          propertyId: property.id,
          propertyTitle: property.title,
        },
      });
      scheduleAfterResponse(async () => {
        // Publish only after the notification result is persisted so the
        // dashboard refetch cannot observe a stale PENDING state.
        await processLeadNotification(lead.id);
        await publishAdminEvent(ADMIN_EVENTS.leadCreated, lead.id);
      });
    } catch (error) {
      if (!isPrismaCode(error, "P2002")) throw error;
      // Concurrent retry with the same UUID: the first insert is the result.
      return jsonNoStore({ success: true, message: "Contato recebido." });
    }
    return jsonNoStore({ success: true, message: "Contato recebido." }, { status: 201 });
  } catch (error) {
    logServerError("leads.create_failed", error);
    return jsonNoStore({ error: "Não foi possível enviar seu contato" }, { status: 500 });
  }
}

function isPrismaCode(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
