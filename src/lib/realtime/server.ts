import "server-only";

import Pusher from "pusher";
import { getPusherServerEnv } from "@/lib/env";
import { logServerError } from "@/lib/logging";
import {
  ADMIN_CHANNEL,
  type AdminEventName,
} from "@/lib/realtime/events";

let client: Pusher | null = null;

function getClient(): Pusher | null {
  const config = getPusherServerEnv();
  if (!config) return null;
  if (!client) {
    client = new Pusher({
      appId: config.PUSHER_APP_ID,
      key: config.PUSHER_KEY,
      secret: config.PUSHER_SECRET,
      cluster: config.PUSHER_CLUSTER,
      useTLS: true,
      timeout: 2_500,
    });
  }
  return client;
}

export async function publishAdminEvent(event: AdminEventName, entityId: string) {
  try {
    const pusher = getClient();
    if (!pusher) return false;
    await pusher.trigger(ADMIN_CHANNEL, event, { entityId });
    return true;
  } catch (error) {
    logServerError("pusher.publish_failed", error);
    return false;
  }
}

export function authorizeAdminChannel(socketId: string, channelName: string) {
  const pusher = getClient();
  if (!pusher) return null;
  return pusher.authorizeChannel(socketId, channelName);
}
