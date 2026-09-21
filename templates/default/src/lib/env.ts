/**
 * Reads and validates the application settings from environment variables (.env).
 * Everything the integration needs to know about the Document Server lives here.
 */
import path from 'node:path';
import { EnvError } from './http';

export type AppEnv = {
  /** Document Server URL for the browser, without a trailing slash. */
  documentServerUrl: string;
  /** Document Server URL for server-side requests, without a trailing slash. */
  documentServerInternalUrl: string;
  /** Empty string when JWT is disabled. */
  jwtSecret: string;
  /** Header the Document Server uses to send JWT to us (default `Authorization`). */
  jwtHeader: string;
  /** Public URL of this app as seen from the Document Server, or `null` to use the request origin. */
  appUrl: string | null;
  /** Editor UI language. */
  lang: string;
  user: { id: string; name: string };
  /** Absolute path of the folder with uploaded files. */
  storageDir: string;
};

export type EnvResult = { ok: true; env: AppEnv } | { ok: false; errors: string[] };

const trimSlash = (value: string) => value.trim().replace(/\/+$/, '');
const isHttpUrl = (value: string) => /^https?:\/\/[^\s/]+/i.test(value);

let cached: EnvResult | undefined;

export function loadEnv(): EnvResult {
  // Cache in production only: in development the developer may edit .env between restarts.
  if (cached && process.env.NODE_ENV === 'production') return cached;

  const errors: string[] = [];

  const documentServerUrl = trimSlash(process.env.DOCUMENT_SERVER_URL ?? '');
  if (!documentServerUrl) {
    errors.push('DOCUMENT_SERVER_URL is not set');
  } else if (!isHttpUrl(documentServerUrl)) {
    errors.push('DOCUMENT_SERVER_URL must be an absolute http(s) URL');
  }

  const internal = trimSlash(process.env.DOCUMENT_SERVER_INTERNAL_URL ?? '');
  if (internal && !isHttpUrl(internal)) {
    errors.push('DOCUMENT_SERVER_INTERNAL_URL must be an absolute http(s) URL');
  }

  const appUrl = trimSlash(process.env.APP_URL ?? '') || null;
  if (appUrl && !isHttpUrl(appUrl)) {
    errors.push('APP_URL must be an absolute http(s) URL');
  }

  if (errors.length > 0) {
    cached = { ok: false, errors };
    return cached;
  }

  cached = {
    ok: true,
    env: {
      documentServerUrl,
      documentServerInternalUrl: internal || documentServerUrl,
      jwtSecret: (process.env.DOCUMENT_SERVER_JWT_SECRET ?? '').trim(),
      jwtHeader: (process.env.DOCUMENT_SERVER_JWT_HEADER ?? '').trim() || 'Authorization',
      appUrl,
      lang: (process.env.DOCS_LANG ?? '').trim() || 'en-US',
      user: {
        id: (process.env.DEMO_USER_ID ?? '').trim() || 'demo-user',
        name: (process.env.DEMO_USER_NAME ?? '').trim() || 'Demo User',
      },
      // The comment tells Turbopack not to trace the whole project because of this dynamic path.
      storageDir: path.resolve(
        /* turbopackIgnore: true */ process.cwd(),
        (process.env.STORAGE_DIR ?? '').trim() || 'storage',
      ),
    },
  };
  return cached;
}

/** Returns the validated settings or throws an `EnvError` (503) for route handlers. */
export function requireEnv(): AppEnv {
  const result = loadEnv();
  if (!result.ok) throw new EnvError(result.errors);
  return result.env;
}
