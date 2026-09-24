import type { DocumentServerFormats } from '@onlyoffice/docs-integration-sdk';
import { getDocumentServerFormats } from './formats';
import { DocumentServerError } from './http';
import { extOf, listFiles } from './storage';
import type { FileListItem } from './types';

export type FileListResult = {
  files: FileListItem[];
  /** Set when the format list could not be loaded from the Document Server. */
  warning?: string;
};

/** Lists stored files and annotates each with how the editor can open it. */
export async function describeFiles(): Promise<FileListResult> {
  const files = await listFiles();

  let formats: DocumentServerFormats | null = null;
  let warning: string | undefined;
  try {
    formats = await getDocumentServerFormats();
  } catch (error) {
    warning = error instanceof DocumentServerError ? error.message : 'Cannot load the format list';
  }

  const items: FileListItem[] = [];
  for (const file of files) {
    const ext = extOf(file.name);
    const permissionEdit = (formats?.isEditable(ext) || formats?.isLossyEditable(ext)) ?? false;
    const lossy = formats?.isLossyEditable(ext) ?? false;

    items.push({
      ...file,
      documentType: formats?.getDocumentType(ext),
      permissionEdit,
      lossy,
    });
  }
  return { files: items, warning };
}
