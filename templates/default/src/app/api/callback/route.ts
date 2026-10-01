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
 * The SDK's `DocumentServerCallback` checks the JWT, tells the statuses apart and answers
 * `{"error": 0}` once the handler is done, or `{"error": 1}` when it failed, so the Document
 * Server posts the callback again.
 */
import {
  CallbackError,
  DocumentServerCallback,
  DocumentServerJwt,
  splitFileUrl,
  type CallbackEvent,
  type CallbackForcesave,
  type CallbackSave,
  type FileLocation,
} from '@onlyoffice/docs-integration-sdk';
import type { AppEnv } from '@/lib/env';
import { callDocumentServer } from '@/lib/document-server';
import { requireEnv } from '@/lib/env';
import { BadRequest, DocumentServerError, handleRoute, Unauthorized } from '@/lib/http';
import { safeName, writeFileAtomic } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reads the callback. With JWT enabled the decoded token is the source of truth, not the plain
 * JSON body; a callback that cannot be trusted is refused with 403, a malformed one with 400.
 */
async function readCallback(request: Request, env: AppEnv): Promise<DocumentServerCallback> {
  try {
    return await DocumentServerCallback.fromRequest(request, {
      verifier: env.jwtSecret
        ? new DocumentServerJwt({ secret: env.jwtSecret, authorizationHeader: env.jwtHeader })
        : null,
    });
  } catch (error) {
    if (!CallbackError.is(error)) throw error;
    if (error.kind === 'body') throw new BadRequest(`Invalid callback: ${error.message}`);
    throw new Unauthorized(`Invalid JWT: ${error.message}`);
  }
}

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

async function saveDocument(
  fileName: string,
  event: CallbackSave | CallbackForcesave,
  env: AppEnv,
) {
  const { path, query } = documentServerPath(event.url, env);

  const response = await callDocumentServer((client) => client.getFile(path, query));
  if (!response.body)
    throw new DocumentServerError('The Document Server answered the download with no body');

  await writeFileAtomic(fileName, response.body);
  console.log(
    `[callback] ${fileName}: saved (${event.kind === 'forcesave' ? 'force save' : 'closed'}, users: ${event.users?.join(', ') ?? '-'})`,
  );
}

export const POST = handleRoute(async (request) => {
  const env = requireEnv();
  const fileName = safeName(new URL(request.url).searchParams.get('file') ?? '');
  const callback = await readCallback(request, env);

  const reply = await callback.handle(
    {
      editing: (event) =>
        console.log(`[callback] ${fileName}: editing (users: ${event.users?.join(', ') ?? '-'})`),
      save: (event) => saveDocument(fileName, event, env),
      forcesave: (event) => saveDocument(fileName, event, env),
      'save-error': (event) =>
        console.error(`[callback] ${fileName}: the Document Server reported a saving error`, event),
      'forcesave-error': (event) =>
        console.error(
          `[callback] ${fileName}: the Document Server reported a force-saving error`,
          event,
        ),
      closed: () => console.log(`[callback] ${fileName}: closed without changes`),
      unknown: (event) => console.warn(`[callback] ${fileName}: unknown status`, event),
    },
    {
      onError: (error: unknown, event: CallbackEvent) =>
        console.error(`[callback] ${fileName}: failed to process status ${event.status}`, error),
    },
  );

  return Response.json(reply);
});
