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
import { splitFileUrl, type FileLocation } from '@onlyoffice/docs-integration-sdk';
import type { AppEnv } from '@/lib/env';
import { callDocumentServer } from '@/lib/document-server';
import { requireEnv } from '@/lib/env';
import { BadRequest, DocumentServerError, handleRoute, HttpError } from '@/lib/http';
import { verifyCallbackBody } from '@/lib/jwt';
import { safeName, writeFileAtomic } from '@/lib/storage';
import type { CallbackBody } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The `url` in the callback is written against the public address (`DOCUMENT_SERVER_URL`),
 * path included, while the app downloads through `DOCUMENT_SERVER_INTERNAL_URL`. The SDK's
 * `splitFileUrl()` takes the public path off and leaves what `getFile()` sends there.
 */
function documentServerPath(url: string, env: AppEnv): FileLocation {
  try {
    return splitFileUrl(url, env.documentServerUrl);
  } catch {
    throw new BadRequest(`Callback "url" is not a valid URL: ${url}`);
  }
}

async function saveDocument(fileName: string, body: CallbackBody, env: AppEnv): Promise<void> {
  if (!body.url) throw new BadRequest('Callback with status 2/6 has no "url"');
  const { path, query } = documentServerPath(body.url, env);

  const response = await callDocumentServer((client) => client.getFile(path, query));
  if (!response.body) throw new DocumentServerError('The Document Server answered the download with no body');

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
