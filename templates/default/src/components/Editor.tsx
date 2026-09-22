'use client';

import type { Config } from '@onlyoffice/doceditor-types';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { EditorMode } from '@/lib/types';
import styles from './Editor.module.css';

// The component injects <script src="<documentServerUrl>/web-apps/apps/api/documents/api.js">
// and creates the editor iframe, so it must only render in the browser.
const DocumentEditor = dynamic(
  () => import('@onlyoffice/document-editor-react').then((m) => m.DocumentEditor),
  { ssr: false, loading: () => <div className={styles.status}>Loading the editor…</div> },
);

type Session = {
  config: Config;
  documentServerUrl: string;
  decision: { mode: EditorMode; lossy: boolean };
  warnings: string[];
};

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; session: Session };

export function Editor({ fileName }: { fileName: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [editorError, setEditorError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/editor-config?file=${encodeURIComponent(fileName)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as Session & { error?: string };
        if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
        return body;
      })
      .then((session) => {
        if (!cancelled) setState({ status: 'ready', session });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: 'error', message: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [fileName]);

  if (state.status === 'loading') {
    return <div className={styles.status}>Preparing the document…</div>;
  }

  if (state.status === 'error') {
    return (
      <div className={styles.padded}>
        <div className="banner banner-error" role="alert">
          <strong>Cannot open the document.</strong> {state.message}
        </div>
      </div>
    );
  }

  const { session } = state;
  const hints = [...session.warnings];
  if (session.decision.lossy) {
    hints.push(
      'This format is edited with possible loss of formatting: the Document Server converts it to an OOXML format while editing and back on save.',
    );
  }

  // The size and the event handlers are part of the config the component passes to
  // DocsAPI.DocEditor; the config from the server carries the JWT and is left untouched.
  const config: Config = {
    ...session.config,
    width: '100%',
    height: '100%',
    events: {
      onDocumentReady: () => console.info('[editor] document ready'),
      onError: (event) => {
        const data = event.data;
        setEditorError(
          data ? `${data.errorDescription ?? 'Unknown error'} (code ${data.errorCode ?? '?'})` : 'Unknown error',
        );
      },
    },
  };

  return (
    <>
      {editorError ? (
        <div className={styles.padded}>
          <div className="banner banner-error" role="alert">
            <strong>Editor error.</strong> {editorError}
          </div>
        </div>
      ) : null}
      {hints.length > 0 && !dismissed ? (
        <div className={styles.padded}>
          <div className={`banner banner-warning ${styles.hints}`} role="status">
            <ul>
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
            <button type="button" className="btn btn-sm" onClick={() => setDismissed(true)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className={styles.frame}>
        <DocumentEditor
          id="onlyoffice-editor"
          documentServerUrl={session.documentServerUrl}
          config={config}
          onLoadComponentError={(errorCode, errorDescription) => {
            setEditorError(
              `${errorDescription} (code ${errorCode}). Check that DOCUMENT_SERVER_URL (${session.documentServerUrl}) is reachable from your browser.`,
            );
          }}
        />
      </div>
    </>
  );
}
