import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Editor } from '@/components/Editor';
import { ErrorBanner } from '@/components/ErrorBanner';
import { loadEnv } from '@/lib/env';
import { findFormat } from '@/lib/formats';
import { HttpError } from '@/lib/http';
import { safeName, statFile } from '@/lib/storage';
import type { DocumentType } from '@/lib/types';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ fileName: string }> };

function decodeName(raw: string): string | null {
  try {
    return safeName(decodeURIComponent(raw));
  } catch {
    return null;
  }
}

/**
 * Tab icon per document type, so an editor tab can be told apart at a glance.
 * The files live in `public/favicons`; every other page keeps the default icon of
 * `app/layout.tsx`.
 */
const FAVICONS: Record<DocumentType, string> = {
  word: '/favicons/word.ico',
  cell: '/favicons/cell.ico',
  slide: '/favicons/slide.ico',
  pdf: '/favicons/pdf.ico',
  diagram: '/favicons/diagram.ico',
};

/** The document type comes from the Document Server; if it is unreachable, there is no icon. */
async function faviconFor(fileName: string): Promise<string | null> {
  try {
    const format = await findFormat(fileName);
    return format ? FAVICONS[format.type] : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeName((await params).fileName);
  if (!name) return { title: 'File not found' };
  const favicon = await faviconFor(name);
  // Without an `icons` field the page inherits the default icon from the root layout.
  return {
    title: `${name} · ONLYOFFICE`,
    ...(favicon ? { icons: { icon: { url: favicon, sizes: '32x32', type: 'image/x-icon' } } } : {}),
  };
}

export default async function EditorPage({ params }: Props) {
  const envResult = loadEnv();
  if (!envResult.ok) {
    return (
      <main className={styles.page}>
        <ErrorBanner title="The application is not configured" errors={envResult.errors} />
      </main>
    );
  }

  const name = decodeName((await params).fileName);
  if (!name) notFound();
  try {
    await statFile(name);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }

  // The editor opens in its own tab and takes the whole viewport; the editor's own header
  // shows the file name, and its "back" button (customization.goback) returns to the file list.
  return (
    <main className={styles.page}>
      <Editor fileName={name} />
    </main>
  );
}
