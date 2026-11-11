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
  // Signed-in users never see the landing page. /dashboard decides whether
  // they still need onboarding.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again.")
    : null;

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">🎬 Movie Memory</h1>
        <p className="text-slate-600">
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
          className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white shadow hover:bg-slate-700"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
