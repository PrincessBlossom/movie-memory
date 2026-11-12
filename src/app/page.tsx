import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Access was denied. Please try again.",
  Configuration: "Sign-in is misconfigured on the server.",
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Signed-in users don't see this landing page after they have signed in
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again.")
    : null;

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Your favorite movie, remembered.
        </h1>
        <p className="text-ink/70">
          Tell us your favorite movie and we&apos;ll dig up fun facts about it.
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      )}

      <form
        action={async () => {
          "use server";
          // Always land on /dashboard; it routes first-time users to onboarding.
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-brand px-6 py-3 font-semibold text-white shadow transition-colors duration-[750ms] hover:bg-ink"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
