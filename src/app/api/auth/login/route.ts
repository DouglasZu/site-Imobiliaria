import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, setAuthCookie } from "@/lib/auth";
import { jsonNoStore, readJsonBody } from "@/lib/http-security";
import { consumeLoginRateLimit, getClientIp } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas/auth";

const MAX_LOGIN_BODY_BYTES = 8 * 1_024;

// A real cost-12 bcrypt hash used only to equalize unknown-account timing.
const DUMMY_PASSWORD_HASH =
  "$2b$12$ljYAjR2G5bhBWg9SoeMHIOOKGVm6q5APRVoa29heFo.7kSFR1X.SO";

function logAuthEvent(
  level: "warn" | "error",
  event: string,
  requestId: string,
  context: Record<string, unknown> = {}
): void {
  const entry = JSON.stringify({ level, event, requestId, ...context });
  if (level === "error") console.error(entry);
  else console.warn(entry);
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  try {
    const body = await readJsonBody(request, MAX_LOGIN_BODY_BYTES);
    if (!body.success) return body.response;

    const result = loginSchema.safeParse(body.data);
    if (!result.success) {
      return jsonNoStore({ error: "Requisição inválida" }, { status: 400 });
    }

    const { email, password } = result.data;
    const rateLimit = await consumeLoginRateLimit({
      ip: getClientIp(request),
      account: email,
    });

    if (!rateLimit.allowed) {
      logAuthEvent("warn", "admin_login_rate_limited", requestId, {
        scopes: rateLimit.violatedScopes,
      });

      return jsonNoStore(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    // Exactly one bcrypt comparison runs for both known and unknown accounts.
    const passwordMatches = await comparePassword(
      password,
      admin?.passwordHash ?? DUMMY_PASSWORD_HASH
    );

    if (!admin || !passwordMatches) {
      logAuthEvent("warn", "admin_login_denied", requestId);
      return jsonNoStore({ error: "Credenciais inválidas" }, { status: 401 });
    }

    const token = await signToken(admin.id);
    await setAuthCookie(token);

    return jsonNoStore({ success: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logAuthEvent("error", "admin_login_failed", requestId, {
      error: error instanceof Error ? error.name : "UnknownError",
      detail,
    });

    return jsonNoStore(
      { error: "Erro interno do servidor", detail },
      { status: 500 }
    );
  }
}
