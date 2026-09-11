/**
 * GET /api/editor-config?file=<name>  → signed editor config for the file
 *
 * The browser fetches this and passes the result to the DocumentEditor component.
 */
import { buildEditorSession } from '@/lib/editor-config';
import { BadRequest, handleRoute } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handleRoute(async (request) => {
  const file = new URL(request.url).searchParams.get('file');
  if (!file) throw new BadRequest('Query parameter "file" is required');
  return Response.json(await buildEditorSession(request, file), {
    headers: { 'Cache-Control': 'no-store' },
  });
});
