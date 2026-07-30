import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { GOOGLE_SCOPES } from "@/config/google";
import { refreshAccessToken } from "@/lib/auth/refresh";

/** Small safety margin so we refresh slightly before the real expiry. */
const EXPIRY_SKEW_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES.join(" "),
          // Required to receive a refresh token from Google.
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist the tokens issued by Google.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
        return token;
      }

      // Still valid → reuse.
      if (token.expiresAt && Date.now() < token.expiresAt - EXPIRY_SKEW_MS) {
        return token;
      }

      // Expired → refresh.
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      if (session.user) {
        session.user.id = token.sub ?? "";
      }
      return session;
    },
  },
});
