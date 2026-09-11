import type { NextConfig } from "next";

/**
 * In development Next.js serves its own assets (/_next/*) only to the origin it was started
 * on (localhost). When the app is opened by a LAN address, e.g. the one in APP_URL that the
 * Document Server uses, those hosts must be allowed explicitly — otherwise the page renders
 * but no client-side JavaScript loads.
 */
function allowedDevOrigins(): string[] {
  const hosts = new Set<string>();
  try {
    const appUrl = process.env.APP_URL?.trim();
    if (appUrl) hosts.add(new URL(appUrl).hostname);
  } catch {
    // APP_URL is validated (and reported) by the app itself.
  }
  for (const host of (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",")) {
    if (host.trim()) hosts.add(host.trim());
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Do not generate AGENTS.md / CLAUDE.md in the project folder on `next dev`.
  agentRules: false,
  // Treat this folder as the project root even when a parent directory has its own lockfile.
  turbopack: { root: __dirname },
  allowedDevOrigins: allowedDevOrigins(),
  // The editor is loaded from the Document Server origin (api.js + iframe), so nothing
  // else is required here. Uploaded files are served by our own route handlers.
};

export default nextConfig;
