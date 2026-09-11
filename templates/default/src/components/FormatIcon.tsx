import type { DocumentType } from '@/lib/types';

const COLORS: Record<DocumentType, string> = {
  word: 'var(--word)',
  cell: 'var(--cell)',
  slide: 'var(--slide)',
  pdf: 'var(--pdf)',
  diagram: 'var(--diagram)',
};

const LABELS: Record<DocumentType, string> = {
  word: 'W',
  cell: 'X',
  slide: 'P',
  pdf: 'PDF',
  diagram: 'D',
};

export function FormatIcon({ type, size = 28 }: { type: DocumentType | null; size?: number }) {
  const color = type ? COLORS[type] : '#9ca3af';
  const label = type ? LABELS[type] : '?';
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 2h11l7 7v17H5z" fill={color} />
      <path d="M16 2v7h7z" fill="rgba(255,255,255,0.45)" />
      <text
        x="14"
        y="21"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize={label.length > 1 ? 7 : 11}
        fill="#fff"
      >
        {label}
      </text>
    </svg>
  );
}
