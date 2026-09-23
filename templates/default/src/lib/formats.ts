/**
 * Supported formats, fetched from the Document Server (`GET <server>/meta/formats`).
 *
 * The response tells, for every extension, which document type it belongs to and which
 * actions are possible (view, edit, lossy-edit, fill, …). It is cached for a few minutes.
 * If the endpoint is unavailable (very old Document Server) a small built-in list is used.
 */
import { DocumentServerFormats, DocumentServerHttpError, type Format } from '@onlyoffice/docs-integration-sdk';
import { callDocumentServer } from './document-server';
import { DocumentServerError } from './http';
import fallbackFormats from './fallback-formats.json';

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

type Cache = { fetchedAt: number; list: readonly Format[] };

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

async function fetchFormats(): Promise<Cache> {
  const list = await callDocumentServer((client) =>
    client.getFormats({ timeoutMs: REQUEST_TIMEOUT_MS }).catch((error: unknown) => {
      // Older Document Server without /meta/formats: fall back to the bundled list.
      if (DocumentServerHttpError.is(error) && error.status === 404) return null;
      throw error;
    }),
  );
  if (list === null) {
    console.warn('[formats] /meta/formats returned 404, using the built-in format list');
    return { fetchedAt: Date.now(), list: fallbackFormats };
  }
  if (list.length === 0) {
    throw new DocumentServerError('/meta/formats returned an empty format list');
  }
  return { fetchedAt: Date.now(), list };
}

async function getCache(): Promise<Cache> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  if (!inflight) {
    inflight = fetchFormats()
      .then((fresh) => {
        cache = fresh;
        return fresh;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** All formats known to the Document Server. */
export async function getFormats(): Promise<readonly Format[]> {
  return (await getCache()).list;
}

/**
 * The cached formats indexed by extension, which is how the SDK looks them up: what a file
 * opens in, what the editors may do with it, what it converts to.
 */
export async function getDocumentServerFormats(): Promise<DocumentServerFormats> {
  return new DocumentServerFormats((await getCache()).list);
}

