import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { saveFavoriteMovie } from "./actions";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await requireUser();
  // Onboarding is first-time only.
  if (user.favoriteMovie !== null) redirect("/dashboard");

  return (
    <div className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-brand">
          Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-ink/70">
          What&apos;s your favorite movie? If several movies share the title,
          add the year, e.g. Dune (1984).
        </p>
      </div>
      <OnboardingForm action={saveFavoriteMovie} />
    </div>
  );
}
