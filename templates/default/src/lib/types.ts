import type { FormatType } from "@onlyoffice/docs-integration-sdk";

export type EditorMode = 'edit' | 'view';

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
  mode: EditorMode | null;
  lossy: boolean;
};

/** Body of the POST request the Document Server sends to `callbackUrl`. */
export type CallbackBody = {
  key: string;
  status: 1 | 2 | 3 | 4 | 6 | 7;
  url?: string;
  changesurl?: string;
  filetype?: string;
  forcesavetype?: number;
  users?: string[];
  actions?: { type: number; userid: string }[];
  history?: unknown;
  token?: string;
};
