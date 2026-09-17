/** Entry of the Document Server `/meta/formats` response. */
export type FormatAction =
  | 'view'
  | 'edit'
  | 'lossy-edit'
  | 'fill'
  | 'comment'
  | 'review'
  | 'customfilter'
  | 'encrypt'
  | 'auto-convert';

export type DocumentType = 'word' | 'cell' | 'slide' | 'pdf' | 'diagram';

export type Format = {
  /** File extension without a dot, lower case. */
  name: string;
  type: DocumentType;
  actions: FormatAction[];
  convert: string[];
  mime: string[];
};

export type EditorMode = 'edit' | 'view';

/** How a file can be opened in the editor, or `null` if the format is not supported. */
export type OpenDecision = {
  mode: EditorMode;
  /** `true` for formats the Document Server can edit only with possible loss of formatting. */
  lossy: boolean;
} | null;

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
  documentType: DocumentType | null;
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
