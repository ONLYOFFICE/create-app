import { loadEnv } from '@/lib/env';
import { describeFiles } from '@/lib/file-list';
import { acceptList, getFormats } from '@/lib/formats';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FileManager } from '@/components/FileManager';
import styles from './page.module.css';

// The file list must never be pre-rendered at build time.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const envResult = loadEnv();

  if (!envResult.ok) {
    return (
      <main className={styles.page}>
        <Header />
        <ErrorBanner
          title="The application is not configured"
          errors={envResult.errors}
          hint={
            <>
              Copy <code>.env.example</code> to <code>.env</code>, fill in the Document Server
              settings and restart the app.
            </>
          }
        />
        <Footer />
      </main>
    );
  }

  const { files, warning } = await describeFiles();
  const accept = warning ? undefined : acceptList(await getFormats());

  return (
    <main className={styles.page}>
      <Header documentServerUrl={envResult.env.documentServerUrl} userName={envResult.env.user.name} />
      <FileManager initialFiles={files} initialWarning={warning} accept={accept} />
      <Footer />
    </main>
  );
}

function Header({ documentServerUrl, userName }: { documentServerUrl?: string; userName?: string }) {
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>ONLYOFFICE Docs – Integration Demo</h1>
        {documentServerUrl ? (
          <p className={`${styles.subtitle} muted`}>
            Document Server: <code>{documentServerUrl}</code>
            {userName ? (
              <>
                {' · '}user: <strong>{userName}</strong>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className={`${styles.footer} muted`}>
      Copyright © {new Date().getFullYear()} Ascensio System SIA. All right reserved
    </footer>
  );
}
