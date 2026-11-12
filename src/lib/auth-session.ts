import "server-only";
import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Auth.js session cookie names (the __Secure- prefix is used over HTTPS).
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * `auth()`, but a database outage throws instead of looking like "signed out".
 *
 * With database sessions, Auth.js catches any error from the session lookup,
 * logs it and returns null. On its own, an unreachable database would then
 * send pages to "/" and make the API answer 401 "You need to sign in".
 *
 * So when there is no session but the browser did send a session cookie, run
 * a trivial query. If it fails, the database is down: rethrow, so pages show
 * error.tsx and route handlers answer 500. If it succeeds, the token really is
 * invalid or expired. Requests with no cookie, or a valid session, cost
 * nothing extra.
 */
export async function getSession(): Promise<Session | null> {
  const session = await auth();
  if (session?.user) return session;

  const jar = await cookies();
  if (SESSION_COOKIES.some((name) => jar.has(name))) {
    await prisma.$queryRaw`SELECT 1`;
  }
  return session;
}
