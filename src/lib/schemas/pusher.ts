import { z } from "zod";
import { ADMIN_CHANNEL } from "@/lib/realtime/events";

export const pusherAuthorizationSchema = z
  .object({
    socketId: z.string().min(3).max(64).regex(/^\d+\.\d+$/),
    channelName: z.literal(ADMIN_CHANNEL),
  })
  .strict("A autorização contém campos não permitidos");
