import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { DashboardShell } from "./DashboardShell";

/**
 * Server entry: authenticates, routes first-time users to onboarding, and
 * seeds the shell with the user's data, so the first paint needs no
 * client-side fetch. Everything interactive lives in DashboardShell.
 */
export default async function DashboardPage() {
  const user = await requireUser(); // no session → "/"
  if (user.favoriteMovie === null) redirect("/onboarding");

  return (
    <DashboardShell
      userId={user.id}
      // Only the fields the UI needs cross to the client
      user={{ name: user.name, email: user.email, image: user.image }}
      initialMovie={user.favoriteMovie}
    />
  );
}
