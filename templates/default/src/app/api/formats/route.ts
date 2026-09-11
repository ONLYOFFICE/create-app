/**
 * GET /api/formats  → formats supported by the Document Server (proxy of <server>/meta/formats)
 */
import { getFormats } from '@/lib/formats';
import { handleRoute } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handleRoute(async () => Response.json(await getFormats()));
