import "server-only";

import { after } from "next/server";

/** Keep non-critical external side effects out of the HTTP response path. */
export function scheduleAfterResponse(task: () => void | Promise<void>) {
  after(task);
}
