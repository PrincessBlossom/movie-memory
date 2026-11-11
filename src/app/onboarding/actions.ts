"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { movieTitleSchema } from "@/lib/validation";

export type OnboardingState = { error: string | null; value: string };

export async function saveFavoriteMovie(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  // Server actions are public POST endpoints, so re-check auth here rather
  // than trusting that the page already did. userId comes from the session.
  const user = await requireUser();

  const raw = formData.get("movie");
  const parsed = movieTitleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: z.treeifyError(parsed.error).errors[0] ?? "Invalid movie title.",
      value: typeof raw === "string" ? raw : "",
    };
  }

  // Conditional update enforces "first-time only" atomically: if the movie is
  // already set (e.g. a replayed request or two tabs), nothing is overwritten.
  await prisma.user.updateMany({
    where: { id: user.id, favoriteMovie: null },
    data: { favoriteMovie: parsed.data },
  });

  redirect("/dashboard");
}
