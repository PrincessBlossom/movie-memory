import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { Fact } from "@/lib/api-contract";
import {
  toFactCardView,
  toFactMeta,
  toInitials,
  toLengthHint,
  toProfileView,
  toSaveFieldError,
  validateMovieDraft,
} from "@/app/dashboard/transforms";
import type { FactState } from "@/app/dashboard/types";

const fact: Fact = {
  id: "f1",
  movie: "Up",
  content: "A fact.",
  recognized: true,
  createdAt: "2026-11-10T12:00:00.000Z",
};
const idle: FactState = { fact: null, fromCache: false, isLoading: false, error: null };
const failure = new ApiError(502, "FACT_GENERATION_FAILED", "Couldn't generate a fact.");

describe("toProfileView", () => {
  it("uses the name, with initials from it", () => {
    expect(toProfileView({ name: "Ada Lovelace", email: "ada@x.com", image: "https://img" })).toEqual({
      displayName: "Ada Lovelace",
      email: "ada@x.com",
      image: "https://img",
      initials: "AL",
    });
  });

  it("falls back to the email when there's no name, and a placeholder when there's neither", () => {
    expect(toProfileView({ name: null, email: "ada.l@x.com", image: null })).toMatchObject({
      displayName: "ada.l@x.com",
      initials: "AL",
    });
    expect(toProfileView({ name: null, email: null, image: null })).toMatchObject({
      displayName: "there",
      initials: "?",
    });
  });

  it("toInitials takes at most two letters", () => {
    expect(toInitials("mary jane watson")).toBe("MJ");
    expect(toInitials("cher")).toBe("C");
  });
});

describe("validateMovieDraft", () => {
  it("rejects a blank title with the schema's message", () => {
    expect(validateMovieDraft("   ", "Up")).toEqual({
      kind: "invalid",
      error: "Please enter a movie title.",
    });
  });

  it("rejects a title over 200 characters", () => {
    expect(validateMovieDraft("x".repeat(201), "Up").kind).toBe("invalid");
  });

  it("treats the same title (after trimming) as unchanged", () => {
    expect(validateMovieDraft("  Up ", "Up")).toEqual({ kind: "unchanged" });
  });

  it("returns the trimmed title when it's valid and new", () => {
    expect(validateMovieDraft(" Heat ", "Up")).toEqual({ kind: "valid", title: "Heat" });
  });
});

describe("toSaveFieldError", () => {
  it("puts the server's message on the field", () => {
    expect(toSaveFieldError(new ApiError(400, "VALIDATION_ERROR", "Too long."))).toBe("Too long.");
  });

  it("returns null for an expired session (redirect instead of reopening)", () => {
    expect(toSaveFieldError(new ApiError(401, "UNAUTHORIZED", "Sign in."))).toBeNull();
  });
});

describe("toFactCardView", () => {
  it("waiting for a movie save wins over everything, and hides errors", () => {
    const view = toFactCardView({ ...idle, fact, error: failure }, true);
    expect(view.body.kind).toBe("waiting");
    expect(view.error).toBeNull();
    expect(view.busy).toBe(true);
  });

  it("first load shows the skeleton", () => {
    const view = toFactCardView({ ...idle, isLoading: true }, false);
    expect(view.body).toEqual({ kind: "loading" });
    expect(view.refreshLabel).toBe("Generating…");
    expect(view.busy).toBe(true);
  });

  it("a refresh keeps the current fact, dimmed", () => {
    const view = toFactCardView({ ...idle, fact, isLoading: true }, false);
    expect(view.body).toMatchObject({ kind: "fact", content: "A fact.", dimmed: true });
  });

  it("a loaded fact has its meta line, and no notice when recognized", () => {
    const view = toFactCardView({ ...idle, fact, fromCache: true }, false);
    expect(view.body).toMatchObject({ kind: "fact", notice: null, dimmed: false });
    expect(view.body.kind === "fact" && view.body.meta).toMatch(/^Generated .+ · from cache$/);
    expect(view.refreshLabel).toBe("New fact");
    expect(view.busy).toBe(false);
  });

  it("an unrecognized title gets a notice naming the movie", () => {
    const view = toFactCardView({ ...idle, fact: { ...fact, recognized: false } }, false);
    expect(view.body.kind === "fact" && view.body.notice).toContain("couldn't find a movie called “Up”");
  });

  it("an error with no fact shows only the error", () => {
    const view = toFactCardView({ ...idle, error: failure }, false);
    expect(view.body).toEqual({ kind: "none" });
    expect(view.error).toBe("Couldn't generate a fact.");
  });

  it("an error keeps the previous fact visible", () => {
    const view = toFactCardView({ ...idle, fact, error: failure }, false);
    expect(view.body.kind).toBe("fact");
    expect(view.error).toBe("Couldn't generate a fact.");
  });

  it("nothing loaded and nothing in progress is the empty state", () => {
    expect(toFactCardView(idle, false).body.kind).toBe("empty");
  });
});

describe("toFactMeta", () => {
  it("omits the cache marker for a fresh fact", () => {
    expect(toFactMeta(fact, false)).not.toContain("cache");
  });
});

describe("toLengthHint", () => {
  it("stays hidden until the title is within 40 characters of the limit", () => {
    expect(toLengthHint("x".repeat(159))).toBeNull();
    expect(toLengthHint("x".repeat(160))).toEqual({ text: "160 / 200 characters", over: false });
  });

  it("at the limit is fine; past it is an error with the overage", () => {
    expect(toLengthHint("x".repeat(200))).toEqual({ text: "200 / 200 characters", over: false });
    expect(toLengthHint("x".repeat(215))).toEqual({
      text: "215 / 200 characters (15 over the limit)",
      over: true,
    });
  });

  it("counts the trimmed title, like validation does", () => {
    expect(toLengthHint(` ${"x".repeat(200)}   `)?.over).toBe(false);
  });
});
