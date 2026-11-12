import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/lib/api";

function mockFetch(impl: () => Promise<Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(impl);
}

const json = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    return err as ApiError;
  }
  throw new Error("expected the promise to reject");
}

afterEach(() => vi.restoreAllMocks());

describe("api client: success", () => {
  it("parses and unwraps a valid response", async () => {
    mockFetch(() =>
      json(200, {
        user: { name: "Ada", email: "ada@example.com", image: null, favoriteMovie: "Up" },
      }),
    );
    await expect(api.getMe()).resolves.toEqual({
      name: "Ada",
      email: "ada@example.com",
      image: null,
      favoriteMovie: "Up",
    });
  });

  it("sends PUT /api/me/movie with a JSON body", async () => {
    const fetchSpy = mockFetch(() => json(200, { favoriteMovie: "Up" }));
    await expect(api.updateMovie("Up")).resolves.toBe("Up");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/me/movie");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ movie: "Up" });
  });

  const storedFact = {
    id: "f1",
    movie: "Up",
    content: "A fact.",
    recognized: true,
    createdAt: "2026-11-11T00:00:00.000Z",
  };

  it("generates a fact with POST /api/fact", async () => {
    const fetchSpy = mockFetch(() => json(200, { fact: storedFact }));
    await expect(api.generateFact()).resolves.toEqual(storedFact);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("/api/fact");
    expect(init?.method).toBe("POST");
  });

  it("reads the latest fact with GET /api/fact, which may be null", async () => {
    const fetchSpy = mockFetch(() => json(200, { fact: null }));
    await expect(api.getLatestFact()).resolves.toBeNull();
    expect(fetchSpy.mock.calls[0]![1]?.method).toBeUndefined(); // fetch's default: GET
  });
});

describe("api client: error normalization", () => {
  it("401 → UNAUTHORIZED with the server's message", async () => {
    mockFetch(() =>
      json(401, { error: { code: "UNAUTHORIZED", message: "You need to sign in." } }),
    );
    const err = await captureError(api.getMe());
    expect(err).toMatchObject({ status: 401, code: "UNAUTHORIZED", message: "You need to sign in." });
  });

  it("400 → VALIDATION_ERROR with the server's message", async () => {
    mockFetch(() =>
      json(400, { error: { code: "VALIDATION_ERROR", message: "Please enter a movie title." } }),
    );
    const err = await captureError(api.updateMovie(""));
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_ERROR", message: "Please enter a movie title." });
  });

  it("500 with a non-JSON body → INTERNAL_ERROR with a generic message", async () => {
    mockFetch(() => Promise.resolve(new Response("<html>Internal Server Error</html>", { status: 500 })));
    const err = await captureError(api.generateFact());
    expect(err).toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect(err.message).toBe("Something went wrong. Please try again.");
  });

  it("401 with a non-contract body still maps to UNAUTHORIZED from the status", async () => {
    mockFetch(() => json(401, { message: "nope" }));
    const err = await captureError(api.getMe());
    expect(err).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("network failure → NETWORK_ERROR with status 0", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const err = await captureError(api.generateFact());
    expect(err).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("2xx that violates the contract → INVALID_RESPONSE", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(() => json(200, { fact: { content: "missing fields" } }));
    const err = await captureError(api.generateFact());
    expect(err).toMatchObject({ status: 200, code: "INVALID_RESPONSE" });
  });
});
