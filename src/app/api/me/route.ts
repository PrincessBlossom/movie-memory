import type { MeResponse } from "@/lib/api-contract";
import { getSessionUserId, jsonOk, unauthorized } from "@/lib/api-server";
import { prisma } from "@/lib/prisma";

/** GET /api/me: the signed-in user's profile and favorite movie. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Explicit select: only fields in the contract leave the server.
    select: { name: true, email: true, image: true, favoriteMovie: true },
  });
  // Session outlived its user row: treat as signed out.
  if (!user) return unauthorized();

  return jsonOk<MeResponse>({ user });
}
