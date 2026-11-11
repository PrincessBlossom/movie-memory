import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/Avatar";
import { SignOutButton } from "@/components/SignOutButton";
import { FactCard, FactCardSkeleton } from "./FactCard";

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
              <p className="truncate text-sm text-slate-500">{user.email}</p>
            )}
          </div>
        </div>
        <SignOutButton />
      </header>

      <section className="space-y-2 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Favorite movie
        </h2>
        <p className="text-2xl font-bold">{user.favoriteMovie}</p>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Fun fact
        </h2>
        <Suspense fallback={<FactCardSkeleton />}>
          <FactCard userId={user.id} movie={user.favoriteMovie} />
        </Suspense>
      </section>
    </div>
  );
}
