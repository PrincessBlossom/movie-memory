"use server";

import { signOut } from "@/auth";
// Sign out action and redirect.
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
