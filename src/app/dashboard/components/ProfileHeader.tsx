"use client";

import type { ProfileView } from "../types";
import { Avatar } from "./Avatar";

/** Photo (or initials), name, email and the log out action. */
export function ProfileHeader({
  profile,
  isSigningOut,
  onSignOut,
}: {
  profile: ProfileView;
  isSigningOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar image={profile.image} initials={profile.initials} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{profile.displayName}</p>
          {profile.email && <p className="truncate text-sm text-ink/70">{profile.email}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!isSigningOut) onSignOut();
        }}
        aria-disabled={isSigningOut}
        className="link-underline cursor-pointer text-sm font-semibold"
      >
        {isSigningOut ? "Logging out…" : "Log out"}
      </button>
    </header>
  );
}
