import "server-only";

import { Resend } from "resend";
import { getResendEnv } from "@/lib/env";
import { logServerError } from "@/lib/logging";

const SEND_TIMEOUT_MS = 4_000;
let client: Resend | null = null;
let clientKey: string | null = null;

export type LeadNotificationResult =
  | { status: "SENT"; id: string }
  | { status: "FAILED" | "UNKNOWN" | "DISABLED" };

export async function sendLeadNotification(input: {
  leadId: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  propertyId: string;
  propertyTitle: string;
}): Promise<LeadNotificationResult> {
  let config;
  try {
    config = getResendEnv();
  } catch (error) {
    logServerError("resend.configuration_invalid", error);
    return { status: "FAILED" };
  }
  if (!config) return { status: "DISABLED" };

  if (!client || clientKey !== config.RESEND_API_KEY) {
    client = new Resend(config.RESEND_API_KEY);
    clientKey = config.RESEND_API_KEY;
  }

  const safeTitle = input.propertyTitle.replace(/[\r\n]+/g, " ").slice(0, 120);
  const text = [
    "Novo contato recebido pelo site.",
    "",
    `Imóvel: ${safeTitle}`,
    `ID do imóvel: ${input.propertyId}`,
    `Nome: ${input.name}`,
    `E-mail: ${input.email}`,
    `Telefone: ${input.phone ?? "Não informado"}`,
    "",
    "Mensagem:",
    input.message,
  ].join("\n");

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const send = client.emails.send(
      {
        from: config.EMAIL_FROM,
        to: [config.CONTACT_EMAIL],
        replyTo: input.email,
        subject: `Novo interesse: ${safeTitle}`,
        text,
      },
      { idempotencyKey: `lead/${input.leadId}` }
    );
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new EmailTimeoutError()), SEND_TIMEOUT_MS);
    });
    const response = await Promise.race([send, timeout]);
    if (response.error || !response.data?.id) {
      logServerError("resend.send_rejected", response.error);
      return { status: "FAILED" };
    }
    return { status: "SENT", id: response.data.id };
  } catch (error) {
    if (error instanceof EmailTimeoutError) {
      logServerError("resend.send_timeout", error);
      return { status: "UNKNOWN" };
    }
    logServerError("resend.send_failed", error);
    // A transport failure can happen after Resend accepted the request. Mark
    // it uncertain so retry uses the same idempotency key.
    return { status: "UNKNOWN" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class EmailTimeoutError extends Error {
  constructor() {
    super("Resend request timed out");
    this.name = "EmailTimeoutError";
  }
}
