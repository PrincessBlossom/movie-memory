"use client";

import { signOutAction } from "@/app/actions";
import { factCache } from "@/lib/fact-cache";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        // Cache entries are already keyed by user id, so another account could
        // never read them. Clearing on sign-out also removes this user's data
        // from the tab.
        factCache.clear();
        await signOutAction();
      }}
    >
      <button type="submit" className="link-underline cursor-pointer text-sm font-semibold">
        Log out
      </button>
    </form>
  );
}
