import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, setAuthCookie } from "@/lib/auth";

// Simple in-memory rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (!checkRateLimit(ip)) {
      return Response.json(
        { error: "Muitas tentativas. Tente novamente em 15 minutos." },
        { status: 429 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json(
        { error: "E-mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { email } });

    // Use constant-time comparison to prevent timing attacks
    // Even if admin is not found, we still hash to keep response time similar
    if (!admin) {
      // Perform a dummy hash comparison to prevent timing leaks
      await comparePassword(password, "$2a$12$000000000000000000000000000000000000000000000000000000");
      return Response.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    const isValid = await comparePassword(password, admin.passwordHash);

    if (!isValid) {
      return Response.json(
        { error: "Credenciais inválidas" },
        { status: 401 }
      );
    }

    // Reset rate limit on successful login
    loginAttempts.delete(ip);

    const token = await signToken({ id: admin.id, email: admin.email });
    await setAuthCookie(token);

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
