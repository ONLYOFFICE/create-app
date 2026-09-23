/**
 * The one place the app talks to the Document Server from, through the ONLYOFFICE SDK.
 *
 * Requests go to `DOCUMENT_SERVER_INTERNAL_URL`, the address this app sees the server at.
 * Every failure the SDK reports (unreachable server, timeout, error status, unexpected
 * body) becomes a `DocumentServerError` (502); anything else is a bug and stays as it is.
 */
import { DocumentServerClient, DocumentServerError as SdkError } from '@onlyoffice/docs-integration-sdk';
import { requireEnv } from './env';
import { DocumentServerError } from './http';

let cached: { baseUrl: string; client: DocumentServerClient } | null = null;

/** The SDK client for the configured Document Server; rebuilt when the address changes. */
export function documentServer(): DocumentServerClient {
  const { documentServerInternalUrl: baseUrl } = requireEnv();
  if (cached?.baseUrl !== baseUrl) {
    cached = { baseUrl, client: new DocumentServerClient({ baseUrl }) };
  }
  return cached.client;
}

/** Runs a request to the Document Server, turning any failure of it into a `DocumentServerError`. */
export async function callDocumentServer<T>(call: (client: DocumentServerClient) => Promise<T>): Promise<T> {
  try {
    return await call(documentServer());
  } catch (error) {
    if (SdkError.is(error)) throw new DocumentServerError(error.message);
    throw error;
  }
}
