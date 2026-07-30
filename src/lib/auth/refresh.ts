import type { JWT } from "next-auth/jwt";

/**
 * Exchange the stored refresh token for a fresh access token using Google's
 * OAuth token endpoint. Called from the JWT callback whenever the current
 * access token is expired. On failure we flag the token so the UI can prompt
 * the user to sign in again.
 */
export async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID ?? "",
        client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
    };

    if (!response.ok || !refreshed.access_token) {
      throw new Error(refreshed.error ?? "Failed to refresh access token");
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      // Google may or may not return a new refresh token; keep the old one.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (error) {
    console.error("[auth] refresh access token failed", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
