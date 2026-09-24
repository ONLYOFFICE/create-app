import type { FormatType } from '@onlyoffice/docs-integration-sdk';

/** Blank templates that can be created from `document-templates/new/<locale>/new.<type>`. */
export type TemplateType = 'docx' | 'xlsx' | 'pptx' | 'pdf';

export type FileInfo = {
  name: string;
  size: number;
  /** ISO 8601 timestamp of the last modification. */
  modified: string;
  mtimeMs: number;
};

/** File entry enriched with format information for the UI. */
export type FileListItem = FileInfo & {
  documentType: FormatType | undefined;
  permissionEdit: boolean;
  lossy: boolean;
};
