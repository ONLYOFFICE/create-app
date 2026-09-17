/**
 * Resolves blank document templates from the `document-templates` git submodule
 * (https://github.com/ONLYOFFICE/document-templates), whose `new/<locale>/` folder holds
 * one blank file per format.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { TemplateType } from './types';

export const TEMPLATE_TYPES: TemplateType[] = ['docx', 'xlsx', 'pptx', 'pdf'];

export const TEMPLATE_TITLES: Record<TemplateType, string> = {
  docx: 'New document',
  xlsx: 'New spreadsheet',
  pptx: 'New presentation',
  pdf: 'New PDF form',
};

const templatesRoot = () => path.join(process.cwd(), 'document-templates', 'new');

/** Shown when the submodule was never checked out, which is the usual reason for an empty folder. */
const MISSING_SUBMODULE =
  'Run "git submodule update --init" to download them.';

export function isTemplateType(value: unknown): value is TemplateType {
  return typeof value === 'string' && (TEMPLATE_TYPES as string[]).includes(value);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Picks the template folder for the configured language: exact match (`ru-RU`), then any
 * folder with the same language prefix (`de` → `de-DE`), then `default`, then `en-US`.
 */
export async function resolveTemplateLocale(lang: string): Promise<string> {
  const root = templatesRoot();
  const folders = (await fs.readdir(root, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const normalized = lang.replace('_', '-');
  const exact = folders.find((f) => f.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;

  const prefix = normalized.split('-')[0].toLowerCase();
  const byPrefix = folders.find((f) => f.toLowerCase().split('-')[0] === prefix);
  if (byPrefix) return byPrefix;

  for (const fallback of ['default', 'en-US']) {
    if (folders.includes(fallback)) return fallback;
  }
  throw new Error(`No document templates found in ${root}. ${MISSING_SUBMODULE}`);
}

export async function resolveTemplatePath(type: TemplateType, lang: string): Promise<string> {
  const locale = await resolveTemplateLocale(lang);
  const candidates = [locale, 'default', 'en-US'];
  for (const folder of candidates) {
    const file = path.join(templatesRoot(), folder, `new.${type}`);
    if (await exists(file)) return file;
  }
  throw new Error(
    `Template new.${type} not found (looked in ${candidates.join(', ')}). ${MISSING_SUBMODULE}`,
  );
}
