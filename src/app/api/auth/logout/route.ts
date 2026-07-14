import { removeAuthCookie } from "@/lib/auth";

export async function POST() {
  await removeAuthCookie();
  return Response.json({ success: true });
}
