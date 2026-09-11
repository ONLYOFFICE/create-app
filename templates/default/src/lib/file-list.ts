import { decideOpen, findFormat, getFormats } from './formats';
import { DocumentServerError } from './http';
import { listFiles } from './storage';
import type { FileListItem } from './types';

export type FileListResult = {
  files: FileListItem[];
  /** Set when the format list could not be loaded from the Document Server. */
  warning?: string;
};

/** Lists stored files and annotates each with how the editor can open it. */
export async function describeFiles(): Promise<FileListResult> {
  const files = await listFiles();

  let warning: string | undefined;
  try {
    await getFormats();
  } catch (error) {
    warning = error instanceof DocumentServerError ? error.message : 'Cannot load the format list';
  }

  const items: FileListItem[] = [];
  for (const file of files) {
    const format = warning ? null : await findFormat(file.name);
    const decision = decideOpen(format);
    items.push({
      ...file,
      documentType: format?.type ?? null,
      mode: decision?.mode ?? null,
      lossy: decision?.lossy ?? false,
    });
  }
  return { files: items, warning };
}
