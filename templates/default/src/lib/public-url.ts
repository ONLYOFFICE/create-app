import type { AppEnv } from './env';

/**
 * Base URL of this application as the Document Server should see it. `APP_URL` wins;
 * otherwise the origin of the incoming request is used (fine when the browser and the
 * Document Server can both reach the app by the same host name).
 */
export function publicBaseUrl(request: Request, env: AppEnv): string {
  if (env.appUrl) return env.appUrl;
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return `${proto}://${host}`;
}

export function isLoopbackHost(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  } catch {
    return false;
  }
}
