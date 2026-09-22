/**
 * Resolves the blank documents behind "New document" from `document-templates/new`, where
 * `scripts/fetch-templates.mjs` downloads them (one file per format, no locales).
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

/** Shown when a template is missing, which means the download never ran or failed. */
const MISSING_TEMPLATES = 'Run "npm run fetch-templates" to download them.';

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

export async function resolveTemplatePath(type: TemplateType): Promise<string> {
  const file = path.join(templatesRoot(), `new.${type}`);
  if (await exists(file)) return file;
  throw new Error(`Template ${file} not found. ${MISSING_TEMPLATES}`);
}
