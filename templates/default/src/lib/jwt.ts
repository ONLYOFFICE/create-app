/**
 * JWT helpers for the Document Server integration (HS256, shared secret).
 *
 * - Outgoing: the editor config sent to the browser is signed and placed in `config.token`.
 * - Incoming: requests from the Document Server (save callback, file download) carry a JWT
 *   either in the request body (`token` field) or in an HTTP header (`Authorization: Bearer …`
 *   by default) whose payload wraps the original body under `payload`.
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { AppEnv } from './env';
import { Unauthorized } from './http';
import type { CallbackBody } from './types';

const encodeSecret = (secret: string) => new TextEncoder().encode(secret);

export async function signPayload(payload: object, secret: string): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(encodeSecret(secret));
}

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

/**
 * Verifies the JWT of a callback request and returns the trusted body.
 * When a token is present its decoded payload is used instead of the unsigned JSON body.
 */
export async function verifyCallbackBody(
  request: Request,
  body: CallbackBody,
  env: AppEnv,
): Promise<CallbackBody> {
  if (!env.jwtSecret) return body;

  if (body.token) {
    return verifyToken<CallbackBody>(body.token, env.jwtSecret);
  }

  const headerToken = tokenFromHeader(request, env.jwtHeader);
  if (!headerToken) {
    throw new Unauthorized(`Missing JWT (expected "${env.jwtHeader}" header or "token" field)`);
  }
  const decoded = await verifyToken<{ payload?: CallbackBody }>(headerToken, env.jwtSecret);
  if (!decoded.payload || typeof decoded.payload !== 'object') {
    throw new Unauthorized('JWT payload does not contain callback data');
  }
  return decoded.payload;
}
