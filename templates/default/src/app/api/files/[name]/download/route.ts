/**
 * GET /api/files/:name/download  → the file content
 *
 * Used by the "Download" button in the UI and, more importantly, by the Document Server:
 * `document.url` in the editor config points here. When JWT is enabled the Document Server
 * signs that request; a present but invalid token is rejected. Requests without a token are
 * allowed because this demo has no user authentication — a real application must authorize
 * this route (e.g. with one-time signed links).
 */
import { Readable } from 'node:stream';
import mime from 'mime';
import { requireEnv } from '@/lib/env';
import { contentDisposition, handleRoute } from '@/lib/http';
import { tokenFromHeader, verifyToken } from '@/lib/jwt';
import { openReadStream, safeName, statFile } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ name: string }> };

export const GET = handleRoute<Context>(async (request, { params }) => {
  const env = requireEnv();
  const name = safeName(decodeURIComponent((await params).name));

  if (env.jwtSecret) {
    const token = tokenFromHeader(request, env.jwtHeader);
    if (token) await verifyToken(token, env.jwtSecret); // throws Unauthorized (403) when invalid
  }

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
