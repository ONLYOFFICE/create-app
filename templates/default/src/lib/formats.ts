/**
 * Supported formats, fetched from the Document Server (`GET <server>/meta/formats`).
 *
 * The response tells, for every extension, which document type it belongs to and which
 * actions are possible (view, edit, lossy-edit, fill, …). It is cached for a few minutes.
 * If the endpoint is unavailable (very old Document Server) a small built-in list is used.
 */
import { DocumentServerHttpError } from '@onlyoffice/docs-integration-sdk';
import { callDocumentServer } from './document-server';
import { DocumentServerError } from './http';
import { extOf } from './storage';
import type { Format, OpenDecision } from './types';
import fallbackFormats from './fallback-formats.json';

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

type Cache = { fetchedAt: number; list: Format[]; byExt: Map<string, Format> };

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

function index(list: Format[], fetchedAt = Date.now()): Cache {
  return {
    fetchedAt,
    list,
    byExt: new Map(list.map((format) => [format.name.toLowerCase(), format])),
  };
}

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
    return index(fallbackFormats as Format[]);
  }
  if (list.length === 0) {
    throw new DocumentServerError('/meta/formats returned an empty format list');
  }
  return index(list as Format[]);
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
export async function getFormats(): Promise<Format[]> {
  return (await getCache()).list;
}

/** Format of a file by its extension, or `null` if the Document Server does not know it. */
export async function findFormat(fileName: string): Promise<Format | null> {
  const ext = extOf(fileName);
  if (!ext) return null;
  return (await getCache()).byExt.get(ext) ?? null;
}

/**
 * Decides how a file can be opened:
 * - `edit`       → full editing;
 * - `lossy-edit` → editing is possible but the format cannot keep every feature
 *                  (the UI warns about it);
 * - `view` only  → read-only viewer;
 * - not supported → `null`.
 */
export function decideOpen(format: Format | null): OpenDecision {
  if (!format || !format.actions.includes('view')) return null;
  if (format.actions.includes('edit')) return { mode: 'edit', lossy: false };
  if (format.actions.includes('lossy-edit')) return { mode: 'edit', lossy: true };
  return { mode: 'view', lossy: false };
}

/** Extensions accepted by the upload control, e.g. `.docx,.xlsx,…`. */
export function acceptList(formats: Format[]): string {
  return formats.map((format) => `.${format.name}`).join(',');
}
