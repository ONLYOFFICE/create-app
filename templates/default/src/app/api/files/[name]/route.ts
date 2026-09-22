/**
 * DELETE /api/files/:name  → removes a stored file
 */
import { handleRoute } from '@/lib/http';
import { deleteFile, safeName } from '@/lib/storage';

export const runtime = 'nodejs';

type Context = { params: Promise<{ name: string }> };

export const DELETE = handleRoute<Context>(async (_request, { params }) => {
  const name = safeName(decodeURIComponent((await params).name));
  await deleteFile(name);
  return new Response(null, { status: 204 });
});
