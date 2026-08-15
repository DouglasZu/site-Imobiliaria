import type { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { ServiceConfigurationError } from "@/lib/env";
import { jsonNoStore, readJsonBody } from "@/lib/http-security";
import { logServerError } from "@/lib/logging";
import { authorizeAdminChannel } from "@/lib/realtime/server";
import { pusherAuthorizationSchema } from "@/lib/schemas/pusher";

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonNoStore({ error: "Não autorizado" }, { status: 401 });

  const body = await readJsonBody(request, 4 * 1_024);
  if (!body.success) return body.response;
  const parsed = pusherAuthorizationSchema.safeParse(body.data);
  if (!parsed.success) {
    return jsonNoStore({ error: "Canal não autorizado" }, { status: 403 });
  }

  try {
    const authorization = authorizeAdminChannel(
      parsed.data.socketId,
      parsed.data.channelName
    );
    if (!authorization) {
      return jsonNoStore({ error: "Realtime indisponível" }, { status: 503 });
    }
    return jsonNoStore(authorization);
  } catch (error) {
    logServerError("pusher.authorization_failed", error);
    const status = error instanceof ServiceConfigurationError ? 503 : 500;
    return jsonNoStore({ error: "Realtime indisponível" }, { status });
  }
}
