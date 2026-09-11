/**
 * POST /api/callback?file=<name>
 *
 * The Document Server posts editing events here (`editorConfig.callbackUrl`), see
 * https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler/
 *
 * status 1 – a user connected to or disconnected from the co-editing session
 * status 2 – the document is ready to be saved (all users closed it): download `url` and store it
 * status 3 – saving error
 * status 4 – the document was closed without changes
 * status 6 – the document is being edited, but the current state is saved (force save)
 * status 7 – force-saving error
 *
 * The handler must reply `{"error": 0}`; anything else makes the editor show an error.
 */
import type { AppEnv } from '@/lib/env';
import { requireEnv } from '@/lib/env';
import { BadRequest, DocumentServerError, handleRoute, HttpError } from '@/lib/http';
import { verifyCallbackBody } from '@/lib/jwt';
import { safeName, writeFileAtomic } from '@/lib/storage';
import type { CallbackBody } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * The `url` in the callback points at the Document Server as the browser knows it. When the
 * app talks to the Document Server through a different address (Docker), swap the prefix.
 */
function internalDocumentServerUrl(url: string, env: AppEnv): string {
  if (env.documentServerInternalUrl !== env.documentServerUrl && url.startsWith(`${env.documentServerUrl}/`)) {
    return env.documentServerInternalUrl + url.slice(env.documentServerUrl.length);
  }
  return url;
}

async function saveDocument(fileName: string, body: CallbackBody, env: AppEnv): Promise<void> {
  if (!body.url) throw new BadRequest('Callback with status 2/6 has no "url"');
  const source = internalDocumentServerUrl(body.url, env);

  let response: Response;
  try {
    response = await fetch(source, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (error) {
    throw new DocumentServerError(`Cannot download the saved document from ${source}: ${(error as Error).message}`);
  }
  if (!response.ok || !response.body) {
    throw new DocumentServerError(`Download of the saved document failed with HTTP ${response.status}`);
  }

  await writeFileAtomic(fileName, response.body);
}

export const POST = handleRoute(async (request) => {
  const env = requireEnv();
  const fileName = safeName(new URL(request.url).searchParams.get('file') ?? '');

  const rawBody = (await request.json().catch(() => null)) as CallbackBody | null;
  if (!rawBody || typeof rawBody !== 'object') throw new BadRequest('Callback body must be JSON');

  // With JWT enabled the decoded token is the source of truth, not the plain JSON body.
  const body = await verifyCallbackBody(request, rawBody, env);

  try {
    switch (body.status) {
      case 1:
        console.log(`[callback] ${fileName}: editing (users: ${body.users?.join(', ') ?? '-'})`);
        break;
      case 2:
      case 6:
        await saveDocument(fileName, body, env);
        console.log(
          `[callback] ${fileName}: saved (${body.status === 6 ? 'force save' : 'closed'}, users: ${body.users?.join(', ') ?? '-'})`,
        );
        break;
      case 3:
      case 7:
        console.error(`[callback] ${fileName}: the Document Server reported a saving error`, body);
        break;
      case 4:
        console.log(`[callback] ${fileName}: closed without changes`);
        break;
      default:
        console.warn(`[callback] ${fileName}: unknown status`, body);
    }
  } catch (error) {
    console.error(`[callback] ${fileName}: failed to process status ${body.status}`, error);
    const status = error instanceof HttpError ? error.status : 500;
    return Response.json({ error: 1, message: (error as Error).message }, { status });
  }

  return Response.json({ error: 0 });
});
