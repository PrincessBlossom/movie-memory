/**
 * End-to-end: sign-in, onboarding and the dashboard, in a real browser against
 * the real Next.js server and the real database (DATABASE_URL).
 *
 * What's real and what's not:
 * - Database, Auth.js session handling, server components, server actions,
 *   route handlers, client cache: all real.
 * - Google's consent screen is not automated (Google blocks automated
 *   sign-ins). The test checks that our button starts the OAuth flow with the
 *   right client and callback, then signs in the way the callback would: it
 *   creates the user and a database session, and sets the session cookie.
 * - OpenAI is replaced by e2e/mock-openai.mjs (see playwright.config.ts).
 *
 * Each run creates a throwaway user (unique @e2e.test email) and deletes it
 * afterwards; facts and sessions cascade.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = `e2e-${randomUUID()}@e2e.test`;
let userId: string | undefined;

test.afterAll(async () => {
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

test("sign-in, onboarding and dashboard", async ({ page, context, baseURL }) => {
  await test.step("landing page starts Google OAuth with our callback", async () => {
    // Stop at Google's door: we only check the redirect our server built.
    let googleUrl: URL | undefined;
    await page.route("https://accounts.google.com/**", (route) => {
      googleUrl = new URL(route.request().url());
      return route.fulfill({ status: 200, body: "Google sign-in (stubbed)" });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await expect.poll(() => googleUrl?.pathname).toContain("/o/oauth2");

    expect(googleUrl!.searchParams.get("client_id")).toBe(process.env.AUTH_GOOGLE_ID);
    expect(googleUrl!.searchParams.get("redirect_uri")).toBe(
      `${baseURL}/api/auth/callback/google`,
    );
    await page.unroute("https://accounts.google.com/**");
  });

  await test.step("signed out: dashboard redirects to landing", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/");
  });

  await test.step("sign in as a new user (what the OAuth callback does)", async () => {
    const user = await prisma.user.create({
      data: { name: "E2E Tester", email, image: null },
    });
    userId = user.id;
    const sessionToken = randomUUID();
    await prisma.session.create({
      data: { sessionToken, userId, expires: new Date(Date.now() + 60 * 60_000) },
    });
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: sessionToken,
        url: baseURL!,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  });

  await test.step("first-time user is sent to onboarding", async () => {
    await page.goto("/");
    await expect(page).toHaveURL("/onboarding");
  });

  await test.step("onboarding rejects a blank title server-side", async () => {
    // Spaces pass the browser's `required` check; the server trims and rejects.
    await page.getByLabel("Favorite movie").fill("   ");
    // After a form action finishes, React resets the form (form.reset()) a
    // moment *after* rendering the error. Wait for that, or the next fill
    // races it and gets wiped. A person can't type that fast.
    const form = page.locator("form", { has: page.getByLabel("Favorite movie") });
    const formReset = form.evaluate(
      (el) => new Promise<void>((done) => el.addEventListener("reset", () => done(), { once: true })),
    );
    await page.getByRole("button", { name: "Continue" }).click();
    // Not getByRole("alert"): Next adds its own (empty) route-announcer alert.
    await expect(page.getByLabel("Favorite movie")).toHaveAccessibleDescription(
      "Please enter a movie title.",
    );
    await formReset;
    await expect(page.getByLabel("Favorite movie")).toHaveValue("   "); // input kept
    await expect(page).toHaveURL("/onboarding");
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(saved.favoriteMovie).toBeNull();
  });

  await test.step("onboarding saves the movie and opens the dashboard", async () => {
    await page.getByLabel("Favorite movie").fill("  Spirited Away  ");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL("/dashboard");

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(saved.favoriteMovie).toBe("Spirited Away"); // trimmed on the server
  });

  await test.step("dashboard shows profile, movie and a generated fact", async () => {
    await expect(page.getByText("E2E Tester")).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("ET", { exact: true })).toBeVisible(); // no photo → initials
    await expect(page.getByText("Spirited Away", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E fact about Spirited Away.")).toBeVisible();
    expect(await prisma.fact.count({ where: { userId } })).toBe(1);
  });

  await test.step("reload within 30s reuses the cached fact", async () => {
    await page.reload();
    await expect(page.getByText("E2E fact about Spirited Away.")).toBeVisible();
    await expect(page.getByText("from cache")).toBeVisible();
    expect(await prisma.fact.count({ where: { userId } })).toBe(1);
  });

  await test.step("onboarding is first-time only", async () => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL("/dashboard");
  });

  await test.step("inline edit saves the movie and fetches a fact for it", async () => {
    await page.getByRole("button", { name: "Edit favorite movie" }).click();
    await page.getByLabel("Favorite movie").fill("Dune (1984)");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Dune (1984)", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E fact about Dune (1984).")).toBeVisible();
    await expect(page.getByText("from cache")).toBeHidden();

    const saved = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(saved.favoriteMovie).toBe("Dune (1984)");
    expect(await prisma.fact.count({ where: { userId } })).toBe(2);
  });

  await test.step("log out ends the session", async () => {
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/");
    expect(await prisma.session.count({ where: { userId } })).toBe(0);

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/");
  });
});
