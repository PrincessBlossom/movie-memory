import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-session";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/api-contract";

/**
 * Helpers that keep every route handler's responses consistent with the
 * contract in `api-contract.ts`.
 */

// Responses contain per-user data: never let a browser or CDN cache them.
const NO_STORE = { "Cache-Control": "private, no-store" };

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers: Record<string, string> = {},
) {
  const body: ApiErrorBody = { error: { code, message } };
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export const unauthorized = () =>
  jsonError(401, "UNAUTHORIZED", "You need to sign in.");

/**
 * The user id from the session, or null. Every route scopes its database
 * queries by this id. It is never read from the URL or request body, so a
 * user cannot address another user's data. A database outage throws (see
 * getSession), so the route answers 500 rather than 401.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}
