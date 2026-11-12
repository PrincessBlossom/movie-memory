import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

/**
 * Loads the signed-in user's DB row, or redirects to the landing page.
 * A database outage throws (see getSession), so it reaches error.tsx.
 * Use at the top of every protected server component / server action.
 *
 * The user id comes exclusively from the server-side session, which is what
 * prevents one user from reading or modifying another user's data.
 */
export async function requireUser() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  // Session exists but the user row is gone (e.g. deleted) — treat as signed out.
  if (!user) redirect("/");

  return user;
}
