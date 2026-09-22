/**
 * GET  /api/files  → list of stored files with format information
 * POST /api/files  → upload one or more files (multipart/form-data, field "files")
 */
import { describeFiles } from '@/lib/file-list';
import { decideOpen, findFormat } from '@/lib/formats';
import { BadRequest, handleRoute } from '@/lib/http';
import { safeName, uniqueName, writeFileAtomic } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handleRoute(async () => Response.json(await describeFiles()));

export const POST = handleRoute(async (request) => {
  const form = await request.formData();
  const uploads = form.getAll('files').filter((entry): entry is File => entry instanceof File);
  if (uploads.length === 0) throw new BadRequest('No files in the request (expected field "files")');

  const saved: string[] = [];
  const rejected: { name: string; reason: string }[] = [];

  for (const upload of uploads) {
    let name: string;
    try {
      name = safeName(upload.name);
    } catch {
      rejected.push({ name: upload.name, reason: 'Invalid file name' });
      continue;
    }

    // Only accept what the Document Server can at least display.
    let supported = true;
    try {
      supported = decideOpen(await findFormat(name)) !== null;
    } catch {
      // Format list unavailable: accept the upload, the UI will mark it as "unsupported" if needed.
    }
    if (!supported) {
      rejected.push({ name, reason: 'Unsupported format' });
      continue;
    }

    const finalName = await uniqueName(name);
    await writeFileAtomic(finalName, new Uint8Array(await upload.arrayBuffer()));
    saved.push(finalName);
  }

  return Response.json({ saved, rejected }, { status: saved.length > 0 ? 201 : 400 });
});
