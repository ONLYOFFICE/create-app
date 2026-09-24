/**
 * JWT helpers for the Document Server integration (HS256, shared secret).
 *
 * The Document Server signs its file download request with a JWT in an HTTP header
 * (`Authorization: Bearer …` by default). The save callback is checked by the SDK's
 * `DocumentServerCallback` instead.
 */
import { jwtVerify, type JWTPayload } from 'jose';
import { Unauthorized } from './http';

const encodeSecret = (secret: string) => new TextEncoder().encode(secret);

export async function verifyToken<T = JWTPayload>(token: string, secret: string): Promise<T> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), { algorithms: ['HS256'] });
    return payload as T;
  } catch {
    throw new Unauthorized('Invalid JWT');
  }
}

/** Extracts the raw token from `<header>: Bearer <jwt>` or returns `null`. */
export function tokenFromHeader(request: Request, headerName: string): string | null {
  const raw = request.headers.get(headerName);
  if (!raw) return null;
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}
