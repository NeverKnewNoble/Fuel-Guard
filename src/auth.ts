import { compare } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/db";
import { users } from "@/db/schema";
import { LOGIN_PATH } from "@/utils/authRoutes";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials sign-in requires JWT sessions; the token only carries id, role and site.
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: LOGIN_PATH, error: LOGIN_PATH },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email", label: "Email address" },
        password: { type: "password", label: "Password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const [user] = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            status: users.status,
            siteId: users.siteId,
            passwordHash: users.passwordHash,
          })
          .from(users)
          .where(sql`lower(${users.email}) = lower(${email})`)
          .limit(1);

        // Invited (no password yet) and disabled accounts can't sign in.
        if (!user || user.status !== "active" || !user.passwordHash) return null;
        if (!(await compare(password, user.passwordHash))) return null;

        await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          siteId: user.siteId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on sign-in; later requests reuse the stored claims.
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.siteId = user.siteId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.siteId = token.siteId;
      return session;
    },
  },
});
