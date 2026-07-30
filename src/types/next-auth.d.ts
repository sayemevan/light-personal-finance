import type { DefaultSession } from "next-auth";

/**
 * Augment Auth.js types so the OAuth tokens we persist on the JWT and expose
 * (server-side only) on the session are strongly typed.
 */
declare module "next-auth" {
  interface Session {
    /** Present only when the token could be refreshed successfully. */
    accessToken?: string;
    error?: "RefreshAccessTokenError";
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Epoch milliseconds at which `accessToken` expires. */
    expiresAt?: number;
    error?: "RefreshAccessTokenError";
  }
}
