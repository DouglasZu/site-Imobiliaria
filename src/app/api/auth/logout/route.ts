import { NextRequest } from "next/server";
import { removeAuthCookie } from "@/lib/auth";
import {
  jsonNoStore,
  validateSameOriginRequest,
} from "@/lib/http-security";

export async function POST(request: NextRequest): Promise<Response> {
  const originError = validateSameOriginRequest(request);
  if (originError) return originError;

  try {
    await removeAuthCookie();
    return jsonNoStore({ success: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "admin_logout_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      })
    );

    return jsonNoStore(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
