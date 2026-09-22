import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ maxWidth: 640, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22 }}>File not found</h1>
      <p className="muted">The file may have been deleted or renamed.</p>
      <Link href="/" className="btn">
        ← Back to files
      </Link>
    </main>
  );
}
