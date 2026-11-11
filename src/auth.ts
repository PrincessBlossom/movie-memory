import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Auth.js config.
 *
 * - Database sessions (the default with an adapter): the session cookie is an
 *   opaque token looked up in the `Session` table, so sessions can be revoked
 *   server-side and no user data lives in the cookie.
 * - Because Prisma can't run on the edge runtime, we do NOT use middleware for
 *   route protection. Each protected page/route calls `auth()` itself.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  pages: {
    // Our landing page hosts the sign-in button; errors land there too.
    signIn: "/",
    error: "/",
  },
  callbacks: {
    // Expose the DB user id on the session so server code can scope queries
    // by it. The id always comes from the session — never from the client.
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
