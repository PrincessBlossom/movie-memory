import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/Avatar";
import { SignOutButton } from "@/components/SignOutButton";
import { MovieDashboard } from "./MovieDashboard";

export default async function DashboardPage() {
  const user = await requireUser(); // no session → "/"
  if (user.favoriteMovie === null) redirect("/onboarding");

  // Google may omit name and/or photo; fall back gracefully.
  const displayName = user.name ?? user.email ?? "there";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={user.name} email={user.email} image={user.image} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{displayName}</p>
            {user.email && (
              <p className="truncate text-sm text-ink/60">{user.email}</p>
            )}
          </div>
        </div>
        <SignOutButton />
      </header>

      {/* Profile above is server-rendered. The interactive part (movie
          editing + facts) is a client component seeded with server data, so
          the first paint needs no client-side fetch for the movie. */}
      <MovieDashboard userId={user.id} initialMovie={user.favoriteMovie} />
    </div>
  );
}
