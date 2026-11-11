import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Fact } from "@/lib/api-contract";
import { ApiError, api } from "@/lib/api";
import { MovieDashboard } from "./MovieDashboard";

// A stable router object, like the real one (a new object per render would
// re-trigger effects that depend on it).
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual, // keep the real ApiError class
    api: { getMe: vi.fn(), updateMovie: vi.fn(), getFact: vi.fn() },
  };
});

const mockApi = vi.mocked(api);

const fact = (movie: string): Fact => ({
  id: `fact-${movie}`,
  movie,
  content: `Fun fact about ${movie}.`,
  createdAt: "2026-11-10T12:00:00.000Z",
});

/** A promise you resolve or reject by hand, to observe in-between states. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderDashboard() {
  const user = userEvent.setup();
  const utils = render(<MovieDashboard userId="user-1" initialMovie="Up" />);
  return { user, ...utils };
}

async function editTitleTo(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: "Edit favorite movie" }));
  const input = screen.getByLabelText("Favorite movie");
  await user.clear(input);
  if (title) await user.type(input, title);
  return input;
}

beforeEach(() => {
  vi.resetAllMocks();
  mockApi.getFact.mockImplementation(async () => fact("Up"));
});

describe("movie edit flow", () => {
  it("shows the new title optimistically, then fetches a fact for it once saved", async () => {
    const { user } = renderDashboard();
    expect(await screen.findByText("Fun fact about Up.")).toBeInTheDocument();

    const save = deferred<string>();
    mockApi.updateMovie.mockReturnValue(save.promise);
    await editTitleTo(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Optimistic: new title immediately, the old fact is hidden, no fact request yet.
    expect(screen.getByText("Heat")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.queryByText("Fun fact about Up.")).not.toBeInTheDocument();
    expect(mockApi.updateMovie).toHaveBeenCalledWith("Heat");
    expect(mockApi.getFact).toHaveBeenCalledTimes(1);

    mockApi.getFact.mockImplementation(async () => fact("Heat"));
    save.resolve("Heat");

    expect(await screen.findByText("Fun fact about Heat.")).toBeInTheDocument();
    expect(screen.getByText("Heat")).toBeInTheDocument();
    expect(mockApi.getFact).toHaveBeenCalledTimes(2);
  });

  it("reverts the title and reopens the editor with the error if the save fails", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");

    const save = deferred<string>();
    mockApi.updateMovie.mockReturnValue(save.promise);
    await editTitleTo(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Heat")).toBeInTheDocument(); // optimistic

    save.reject(new ApiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."));

    // The editor reopens with what the user typed, plus the error.
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByLabelText("Favorite movie")).toHaveValue("Heat");

    // Cancelling shows the reverted title, and the old fact comes back from
    // the cache without a new request.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Up")).toBeInTheDocument();
    expect(screen.queryByText("Heat")).not.toBeInTheDocument();
    expect(await screen.findByText("Fun fact about Up.")).toBeInTheDocument();
    expect(mockApi.getFact).toHaveBeenCalledTimes(1);
  });

  it("Cancel and Escape discard edits without a request", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");

    await editTitleTo(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Up")).toBeInTheDocument();

    await editTitleTo(user, "Heat");
    await user.keyboard("{Escape}");
    expect(screen.getByText("Up")).toBeInTheDocument();

    expect(mockApi.updateMovie).not.toHaveBeenCalled();
  });

  it("rejects a blank title client-side without a request", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");

    const input = await editTitleTo(user, "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a movie title.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(mockApi.updateMovie).not.toHaveBeenCalled();
  });

  it("treats an unchanged title (after trimming) as a no-op", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");

    await editTitleTo(user, "  Up  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Up")).toBeInTheDocument();
    expect(mockApi.updateMovie).not.toHaveBeenCalled();
  });

  it("redirects to sign-in when the session has expired", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");

    mockApi.updateMovie.mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Your session has expired."));
    await editTitleTo(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  });

  it("after a network error, adopts the server's value if the save actually landed", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");

    mockApi.updateMovie.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server."));
    mockApi.getMe.mockResolvedValue({ name: null, email: null, image: null, favoriteMovie: "Heat" });
    mockApi.getFact.mockImplementation(async () => fact("Heat"));
    await editTitleTo(user, "Heat");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Fun fact about Heat.")).toBeInTheDocument();
    expect(screen.getByText("Heat")).toBeInTheDocument();
  });
});

describe("keyboard accessibility", () => {
  it("returns focus to the Edit button after Cancel, Escape and Save", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");
    const editButton = () => screen.getByRole("button", { name: "Edit favorite movie" });

    await user.click(editButton());
    expect(screen.getByLabelText("Favorite movie")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(editButton()).toHaveFocus();

    await user.click(editButton());
    await user.keyboard("{Escape}");
    expect(editButton()).toHaveFocus();

    // During a save the Edit button keeps focus but is marked unavailable.
    const save = deferred<string>();
    mockApi.updateMovie.mockReturnValue(save.promise);
    await editTitleTo(user, "Heat");
    await user.keyboard("{Enter}");
    expect(editButton()).toHaveFocus();
    expect(editButton()).toHaveAttribute("aria-disabled", "true");
    await user.click(editButton()); // ignored while saving
    expect(screen.queryByLabelText("Favorite movie")).not.toBeInTheDocument();

    mockApi.getFact.mockImplementation(async () => fact("Heat"));
    save.resolve("Heat");
    await waitFor(() => expect(editButton()).toHaveAttribute("aria-disabled", "false"));
  });

  it("keeps 'New fact' focusable while loading, without sending duplicate requests", async () => {
    const { user } = renderDashboard();
    await screen.findByText("Fun fact about Up.");

    const pending = deferred<Fact>();
    mockApi.getFact.mockReturnValue(pending.promise);
    const button = screen.getByRole("button", { name: "New fact" });
    await user.click(button);

    const busyButton = screen.getByRole("button", { name: "Generating…" });
    expect(busyButton).toHaveFocus();
    expect(busyButton).toHaveAttribute("aria-disabled", "true");
    await user.click(busyButton);
    expect(mockApi.getFact).toHaveBeenCalledTimes(2); // initial load + one refresh

    pending.resolve({ ...fact("Up"), id: "f2", content: "Another Up fact." });
    expect(await screen.findByText("Another Up fact.")).toBeInTheDocument();
  });
});

describe("fact caching", () => {
  it("reuses a fact within 30s and bypasses the cache on 'New fact'", async () => {
    const first = renderDashboard();
    await screen.findByText("Fun fact about Up.");
    first.unmount();

    // Remount (e.g. page refresh): served from the cache, no new request.
    const { user } = renderDashboard();
    expect(await screen.findByText("Fun fact about Up.")).toBeInTheDocument();
    expect(screen.getByText(/from cache/)).toBeInTheDocument();
    expect(mockApi.getFact).toHaveBeenCalledTimes(1);

    // Explicit request: always goes to the server.
    mockApi.getFact.mockImplementation(async () => ({ ...fact("Up"), id: "f2", content: "Another Up fact." }));
    await user.click(screen.getByRole("button", { name: "New fact" }));
    expect(await screen.findByText("Another Up fact.")).toBeInTheDocument();
    expect(mockApi.getFact).toHaveBeenCalledTimes(2);
  });

  it("shows an error with a retry when fact generation fails", async () => {
    mockApi.getFact.mockRejectedValueOnce(
      new ApiError(502, "FACT_GENERATION_FAILED", "Couldn't generate a fact right now."),
    );
    const { user } = renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't generate a fact right now.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Fun fact about Up.")).toBeInTheDocument();
  });
});
