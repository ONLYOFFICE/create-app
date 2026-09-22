/**
 * POST /api/files/create  { type: "docx" | "xlsx" | "pptx" | "pdf", name?: string }
 * Creates a new blank document from the templates in ./document-templates.
 */
import { isTemplateType, resolveTemplatePath, TEMPLATE_TITLES } from '@/lib/document-templates';
import { BadRequest, handleRoute } from '@/lib/http';
import { copyIntoStorage, safeName, statFile, uniqueName } from '@/lib/storage';

export const runtime = 'nodejs';

export const POST = handleRoute(async (request) => {
  const body = (await request.json().catch(() => null)) as { type?: unknown; name?: unknown } | null;
  if (!body || !isTemplateType(body.type)) {
    throw new BadRequest('Field "type" must be one of docx, xlsx, pptx, pdf');
  }

  const requested = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : TEMPLATE_TITLES[body.type];
  const stem = requested.replace(new RegExp(`\\.${body.type}$`, 'i'), '');
  const name = await uniqueName(safeName(`${stem}.${body.type}`));

  const template = await resolveTemplatePath(body.type);
  await copyIntoStorage(template, name);

  return Response.json({ file: await statFile(name) }, { status: 201 });
});
