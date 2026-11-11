import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
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
        <p className="text-ink/70">Type in a movie. If you know of multiple movies with the same title, add the year (e. g. Dune (1984) vs Dune (2021)).  </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
