import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Editor } from '@/components/Editor';
import { ErrorBanner } from '@/components/ErrorBanner';
import { loadEnv } from '@/lib/env';
import { HttpError } from '@/lib/http';
import { safeName, statFile } from '@/lib/storage';
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

export async function generateMetadata({ params }: Props) {
  const name = decodeName((await params).fileName);
  return { title: name ? `${name} · ONLYOFFICE Docs` : 'File not found' };
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className="btn btn-sm">
          ← Back to files
        </Link>
        <span className={styles.fileName}>{name}</span>
      </header>
      <div className={styles.editor}>
        <Editor fileName={name} />
      </div>
    </main>
  );
}
