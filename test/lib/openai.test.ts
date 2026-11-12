// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("openai", () => {
  class APIError extends Error {
    constructor(readonly status: number) {
      super(`status ${status}`);
    }
  }
  class OpenAI {
    static APIError = APIError;
    responses = { create };
  }
  return { default: OpenAI };
});

import OpenAI from "openai";
import { FactGenerationError, MODEL, generateMovieFact } from "@/lib/openai";

const reply = (output_text: string) => ({ output_text, status: "completed", incomplete_details: null });

beforeEach(() => vi.resetAllMocks());

describe("generateMovieFact", () => {
  it("defaults to the cheaper gpt-6-luna model", () => {
    expect(MODEL).toBe("gpt-6-luna");
  });

  it("asks for structured output and returns the fact with its recognized flag", async () => {
    create.mockResolvedValue(reply('{"recognized":true,"fact":" Up opens with a wordless montage. "}'));
    await expect(generateMovieFact("Up")).resolves.toEqual({
      content: "Up opens with a wordless montage.",
      recognized: true,
    });
    const args = create.mock.calls[0]![0];
    expect(args.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(args.input).toContain("<movie_title>Up</movie_title>");
  });

  it("passes recognized: false through for an unidentified title", async () => {
    create.mockResolvedValue(reply('{"recognized":false,"fact":"No such film; The Blob (1958) used silicone."}'));
    await expect(generateMovieFact("Zxqv")).resolves.toMatchObject({ recognized: false });
  });

  it("sends previous facts in a delimited block", async () => {
    create.mockResolvedValue(reply('{"recognized":true,"fact":"New."}'));
    await generateMovieFact("Up", ["Old one."]);
    expect(create.mock.calls[0]![0].input).toContain("<previous_facts>\n- Old one.\n</previous_facts>");
  });

  it.each([
    ["empty output", ""],
    ["non-JSON output", "Up is great."],
    ["JSON missing a field", '{"fact":"x"}'],
    ["an empty fact", '{"recognized":true,"fact":"  "}'],
  ])("fails cleanly on %s", async (_label, text) => {
    create.mockResolvedValue(reply(text));
    await expect(generateMovieFact("Up")).rejects.toMatchObject({ reason: "failed" });
  });

  it("maps OpenAI's 429 to rate_limited", async () => {
    create.mockRejectedValue(new (OpenAI as unknown as { APIError: new (s: number) => Error }).APIError(429));
    const err = await generateMovieFact("Up").catch((e) => e);
    expect(err).toBeInstanceOf(FactGenerationError);
    expect(err.reason).toBe("rate_limited");
  });
});
