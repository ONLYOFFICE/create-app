/**
 * GET /api/files/:name/download  → the file content
 *
 * Used by the "Download" button in the UI and, more importantly, by the Document Server:
 * `document.url` in the editor config points here. When JWT is enabled the Document Server
 * signs that request in `DOCUMENT_SERVER_JWT_HEADER`, and the SDK's `DocumentServerJwt` checks
 * it; a present but invalid token is rejected with 403. Requests without a token are
 * allowed because this demo has no user authentication — a real application must authorize
 * this route (e.g. with one-time signed links).
 */
import { Readable } from 'node:stream';
import { DocumentServerJwt, JwtError } from '@onlyoffice/docs-integration-sdk';
import mime from 'mime';
import type { AppEnv } from '@/lib/env';
import { requireEnv } from '@/lib/env';
import { contentDisposition, handleRoute, Unauthorized } from '@/lib/http';
import { openReadStream, safeName, statFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ name: string }> };

/** Checks the JWT of the request, if it carries one; a request with none is let through. */
async function verifyRequest(request: Request, env: AppEnv): Promise<void> {
  if (!env.jwtSecret) return;

  try {
    await new DocumentServerJwt({
      secret: env.jwtSecret,
      authorizationHeader: env.jwtHeader,
    }).verifyHeader(request.headers);
  } catch (error) {
    if (!JwtError.is(error)) throw error;
    if (error.kind !== 'missing') throw new Unauthorized(`Invalid JWT: ${error.message}`);
  }
}

export const GET = handleRoute<Context>(async (request, { params }) => {
  const env = requireEnv();
  const name = safeName(decodeURIComponent((await params).name));

  await verifyRequest(request, env);

  const info = await statFile(name);
  const stream = Readable.toWeb(openReadStream(name)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      'Content-Type': mime.getType(name) ?? 'application/octet-stream',
      'Content-Length': String(info.size),
      'Content-Disposition': contentDisposition(name),
      'Cache-Control': 'no-store',
    },
  });
});
