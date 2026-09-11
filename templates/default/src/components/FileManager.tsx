'use client';

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import type { FileListItem, TemplateType } from '@/lib/types';
import { CreateDialog } from './CreateDialog';
import { FormatIcon } from './FormatIcon';
import styles from './FileManager.module.css';

type Props = {
  initialFiles: FileListItem[];
  initialWarning?: string;
  /** Value for the file input `accept` attribute, or undefined to accept anything. */
  accept?: string;
};

type Notice = { kind: 'error' | 'info'; text: string };

// A fixed locale keeps the server-rendered HTML identical to the client render (hydration).
const sizeFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const editorUrl = (fileName: string) => `/editor/${encodeURIComponent(fileName)}`;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormatter.format(bytes / 1024)} KB`;
  return `${sizeFormatter.format(bytes / (1024 * 1024))} MB`;
}

const subscribeNoop = () => () => {};

/**
 * Renders a timestamp in the visitor's locale and time zone. During server rendering and
 * hydration the ISO date is used, so the markup matches; the browser then re-renders it.
 */
function LocalDateTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribeNoop,
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)),
    () => iso.slice(0, 16).replace('T', ' '),
  );
  return <time dateTime={iso}>{text}</time>;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // not JSON
  }
  return `Request failed with HTTP ${response.status}`;
}

export function FileManager({ initialFiles, initialWarning, accept }: Props) {
  const [files, setFiles] = useState(initialFiles);
  const [warning, setWarning] = useState(initialWarning);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<TemplateType>('docx');
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/files', { cache: 'no-store' });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { files: FileListItem[]; warning?: string };
    setFiles(data.files);
    setWarning(data.warning);
  }, []);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      setNotice(null);
      try {
        await action();
      } catch (error) {
        setNotice({ kind: 'error', text: (error as Error).message });
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const upload = useCallback(
    (list: FileList | File[]) => {
      const selected = Array.from(list);
      if (selected.length === 0) return;
      void run(async () => {
        const form = new FormData();
        for (const file of selected) form.append('files', file, file.name);
        const response = await fetch('/api/files', { method: 'POST', body: form });
        const data = (await response.json().catch(() => ({}))) as {
          saved?: string[];
          rejected?: { name: string; reason: string }[];
          error?: string;
        };
        if (!response.ok && !data.rejected?.length) {
          throw new Error(data.error ?? `Upload failed with HTTP ${response.status}`);
        }
        await refresh();
        if (data.rejected?.length) {
          setNotice({
            kind: 'error',
            text: `Not uploaded: ${data.rejected.map((r) => `${r.name} (${r.reason.toLowerCase()})`).join(', ')}`,
          });
        } else if (data.saved?.length) {
          setNotice({ kind: 'info', text: `Uploaded ${data.saved.length} file${data.saved.length > 1 ? 's' : ''}` });
        }
      });
    },
    [refresh, run],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) upload(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) upload(event.dataTransfer.files);
  };

  const create = (type: TemplateType, name: string) => {
    // Open the tab synchronously (inside the click handler) so pop-up blockers allow it,
    // then point it at the editor once the file exists.
    const editorTab = window.open('', '_blank');
    void run(async () => {
      try {
        const response = await fetch('/api/files/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, name }),
        });
        if (!response.ok) throw new Error(await readError(response));
        const data = (await response.json()) as { file: { name: string } };
        setCreateOpen(false);
        const url = editorUrl(data.file.name);
        if (editorTab) editorTab.location.href = url;
        else window.open(url, '_blank');
        await refresh();
      } catch (error) {
        editorTab?.close();
        throw error;
      }
    });
  };

  const remove = (name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    void run(async () => {
      const response = await fetch(`/api/files/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readError(response));
      await refresh();
    });
  };

  const openCreate = (type: TemplateType) => {
    setCreateType(type);
    setCreateOpen(true);
  };

  return (
    <section
      className={`${styles.wrapper} ${dragging ? styles.dragging : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {warning ? (
        <div className="banner banner-warning" role="status">
          <strong>Cannot reach the Document Server.</strong> {warning}
          <br />
          Files are listed, but the supported formats are unknown until the Document Server is available.
        </div>
      ) : null}

      {notice ? (
        <div className={`banner ${notice.kind === 'error' ? 'banner-error' : 'banner-info'}`} role="status">
          {notice.text}
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <span className={`${styles.toolbarLabel} muted`}>New:</span>
          <button type="button" className="btn" onClick={() => openCreate('docx')} disabled={busy}>
            <FormatIcon type="word" size={18} /> Document
          </button>
          <button type="button" className="btn" onClick={() => openCreate('xlsx')} disabled={busy}>
            <FormatIcon type="cell" size={18} /> Spreadsheet
          </button>
          <button type="button" className="btn" onClick={() => openCreate('pptx')} disabled={busy}>
            <FormatIcon type="slide" size={18} /> Presentation
          </button>
          <button type="button" className="btn" onClick={() => openCreate('pdf')} disabled={busy}>
            <FormatIcon type="pdf" size={18} /> PDF form
          </button>
        </div>
        <div className={styles.toolbarGroup}>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={accept}
            hidden
            onChange={handleInputChange}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Upload files'}
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Access</th>
              <th>Size</th>
              <th>Modified</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  No files yet. Create a new document or drop files here to upload them.
                </td>
              </tr>
            ) : (
              files.map((file) => <FileRow key={file.name} file={file} busy={busy} onDelete={remove} />)
            )}
          </tbody>
        </table>
      </div>

      <CreateDialog
        open={createOpen}
        initialType={createType}
        busy={busy}
        onClose={() => setCreateOpen(false)}
        onCreate={create}
      />
    </section>
  );
}

function FileRow({
  file,
  busy,
  onDelete,
}: {
  file: FileListItem;
  busy: boolean;
  onDelete: (name: string) => void;
}) {
  const encoded = encodeURIComponent(file.name);
  const canOpen = file.mode !== null;
  const editorHref = editorUrl(file.name);

  return (
    <tr>
      <td>
        <div className={styles.nameCell}>
          <FormatIcon type={file.documentType} />
          {canOpen ? (
            <a
              href={editorHref}
              target="_blank"
              rel="noopener"
              className={styles.fileName}
              title={`Open ${file.name} in a new tab`}
            >
              {file.name}
            </a>
          ) : (
            <span className={styles.fileName}>{file.name}</span>
          )}
        </div>
      </td>
      <td>
        {file.mode === 'edit' && file.lossy ? (
          <span className="badge badge-lossy" title="The Document Server can edit this format, but some formatting may be lost on save">
            Edit · lossy
          </span>
        ) : file.mode === 'edit' ? (
          <span className="badge badge-edit">Edit</span>
        ) : file.mode === 'view' ? (
          <span className="badge badge-view">View only</span>
        ) : (
          <span className="badge" title="The Document Server does not support this format">
            Unsupported
          </span>
        )}
      </td>
      <td className="muted">{formatSize(file.size)}</td>
      <td className="muted">
        <LocalDateTime iso={file.modified} />
      </td>
      <td>
        <div className={styles.actions}>
          {canOpen ? (
            <a href={editorHref} target="_blank" rel="noopener" className="btn btn-sm">
              {file.mode === 'edit' ? 'Edit' : 'View'}
            </a>
          ) : null}
          <a href={`/api/files/${encoded}/download`} className="btn btn-sm" download={file.name}>
            Download
          </a>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={() => onDelete(file.name)}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
