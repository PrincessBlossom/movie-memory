import { createFactForUser } from "@/lib/facts";

/**
 * Async server component: generates (and stores) a fresh fact on each render.
 * Rendered inside <Suspense> so the rest of the dashboard streams immediately
 * while OpenAI is working. Variant B replaces this with GET /api/fact plus
 * client-side caching.
 */
export async function FactCard({
  userId,
  movie,
}: {
  userId: string;
  movie: string;
}) {
  try {
    const fact = await createFactForUser(userId, movie);
    return <p className="text-slate-800">{fact.content}</p>;
  } catch (err) {
    console.error("Fact generation failed", err);
    return (
      <p role="alert" className="text-sm text-red-600">
        Couldn&apos;t generate a fact right now. Refresh the page to try again.
      </p>
    );
  }
}

export function FactCardSkeleton() {
  return (
    <div className="animate-pulse space-y-2" aria-label="Loading fun fact">
      <div className="h-4 w-full rounded bg-slate-200" />
      <div className="h-4 w-2/3 rounded bg-slate-200" />
    </div>
  );
}
