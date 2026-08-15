"use client";

import Pusher from "pusher-js";
import {
  ADMIN_CHANNEL,
  ADMIN_EVENTS,
  type AdminEventName,
} from "@/lib/realtime/events";

export function subscribeToAdminEvents(
  onEvent: (event: AdminEventName, entityId: string) => void
) {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster || !/^[a-z0-9-]{2,20}$/.test(cluster)) return () => undefined;

  const pusher = new Pusher(key, {
    cluster,
    forceTLS: true,
    enabledTransports: ["ws"],
    channelAuthorization: {
      customHandler: (params, callback) => {
        void fetch("/api/pusher/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            socketId: params.socketId,
            channelName: params.channelName,
          }),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("Pusher authorization failed");
            return response.json() as Promise<{ auth: string }>;
          })
          .then((authorization) => callback(null, authorization))
          .catch((error: unknown) =>
            callback(error instanceof Error ? error : new Error("Pusher authorization failed"), null)
          );
      },
    },
  });

  const channel = pusher.subscribe(ADMIN_CHANNEL);
  let debounce: ReturnType<typeof setTimeout> | undefined;
  for (const event of Object.values(ADMIN_EVENTS) as AdminEventName[]) {
    channel.bind(event, (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== "object" ||
        !("entityId" in payload) ||
        typeof payload.entityId !== "string"
      ) {
        return;
      }
      const entityId = payload.entityId;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => onEvent(event, entityId), 150);
    });
  }

  return () => {
    if (debounce) clearTimeout(debounce);
    channel.unbind_all();
    pusher.unsubscribe(ADMIN_CHANNEL);
    pusher.disconnect();
  };
}
