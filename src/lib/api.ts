/**
 * Typed client for the Movie Memory API.
 *
 * Every call goes through `request()`, which guarantees exactly two outcomes:
 *   1. resolves with data that has been validated against the contract schema, or
 *   2. rejects with an `ApiError`, with a normalized `code` and a user-safe `message`.
 *
 * UI code therefore never inspects raw `Response`s, status codes or JSON
 * shapes. It switches on `error.code` (e.g. redirect on "UNAUTHORIZED").
 */
import type { z } from "zod";
import {
  apiErrorBodySchema,
  factResponseSchema,
  meResponseSchema,
  updateMovieResponseSchema,
  type ApiErrorCode,
  type Fact,
  type Me,
  type UpdateMovieRequest,
} from "@/lib/api-contract";

/** Longer than the server's 15s OpenAI timeout, so the server's error wins. */
const REQUEST_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when no response was received. */
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Fallbacks for error responses that don't follow the contract (e.g. a proxy's HTML 502). */
function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  return "INTERNAL_ERROR";
}

const GENERIC_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  UNAUTHORIZED: "Your session has expired. Please sign in again.",
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
  INVALID_RESPONSE: "The server sent an unexpected response.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
};

function genericMessage(code: ApiErrorCode): string {
  return GENERIC_MESSAGES[code] ?? "Something went wrong. Please try again.";
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
      credentials: "same-origin", // send the session cookie
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    // fetch only rejects when there's no response at all: offline, DNS, CORS, timeout.
    throw new ApiError(0, "NETWORK_ERROR", genericMessage("NETWORK_ERROR"));
  }

  // Read the body once, tolerating empty and non-JSON bodies.
  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsed = apiErrorBodySchema.safeParse(body);
    if (parsed.success) {
      const { code, message } = parsed.data.error;
      throw new ApiError(response.status, code, message);
    }
    const code = codeForStatus(response.status);
    throw new ApiError(response.status, code, genericMessage(code));
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // A 2xx that breaks the contract is a bug; fail loudly rather than
    // letting `undefined` leak into the UI.
    console.error(`Response from ${path} failed validation`, parsed.error);
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      genericMessage("INVALID_RESPONSE"),
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export const api = {
  /** GET /api/me */
  async getMe(): Promise<Me> {
    const { user } = await request("/api/me", meResponseSchema);
    return user;
  },

  /** PUT /api/me/movie: resolves with the title as stored (trimmed). */
  async updateMovie(movie: string): Promise<string> {
    const body: UpdateMovieRequest = { movie };
    const { favoriteMovie } = await request(
      "/api/me/movie",
      updateMovieResponseSchema,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return favoriteMovie;
  },

  /** GET /api/fact: generates a new fact on the server. */
  async getFact(): Promise<Fact> {
    const { fact } = await request("/api/fact", factResponseSchema);
    return fact;
  },
};

export type Api = typeof api;
