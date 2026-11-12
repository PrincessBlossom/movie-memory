/**
 * Types for the dashboard: the shell's state, and the view models it hands to
 * components. Components only ever receive view models (already formatted,
 * state already decided), never raw API data.
 */
import type { ApiError } from "@/lib/api";
import type { Fact } from "@/lib/api-contract";

// ---------------------------------------------------------------------------
// Shell state
// ---------------------------------------------------------------------------

/** What useFact tracks for the current movie. */
export type FactState = {
  /** The fact to show. */
  fact: Fact | null;
  /** True if `fact` came from the 30s cache rather than a request. */
  fromCache: boolean;
  isLoading: boolean;
  error: ApiError | null;
};

/** The inline movie editor (controlled by the shell) */
export type EditorState = {
  isEditing: boolean;
  draft: string;
  /** Field error: from client validation. */
  error: string | null;
};

/** The signed-in user as the server page loads them. Name, email and image may be missing. */
export type DashboardUser = {
  name: string | null;
  email: string | null;
  image: string | null;
};

// ---------------------------------------------------------------------------
// View models (component props)
// ---------------------------------------------------------------------------

export type ProfileView = {
  displayName: string;
  email: string | null;
  image: string | null;
  /** Shown either when there is no profile picture or if it does not load.. */
  initials: string;
};

/** One of these is shown in the fact card's body. */
export type FactBodyView =
  /** A movie save is being processed, so a fact for the new movie follows. */
  | { kind: "waiting"; message: string }
  /** First load: skeleton. */
  | { kind: "loading" }
  | {
      kind: "fact";
      content: string;
      /** e.g. "Generated 3:04 PM · from cache" */
      meta: string;
      /** Set when the model didn't recognize the title, so the fact is about a similar film. */
      notice: string | null;
      /** A replacement is loading; show the current fact dimmed. */
      dimmed: boolean;
    }
  | { kind: "empty"; message: string }
  /** Nothing to show besides the error. */
  | { kind: "none" };

export type FactCardView = {
  body: FactBodyView;
  /** Error message with a "Try again" action, or null. */
  error: string | null;
  /** The "New fact" action is unavailable. */
  busy: boolean;
  refreshLabel: string;
};

/** Result of checking the editor's draft before saving. */
export type DraftCheck =
  | { kind: "invalid"; error: string }
  | { kind: "unchanged" }
  | { kind: "valid"; title: string };
