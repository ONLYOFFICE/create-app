import Image, { type StaticImageData } from 'next/image';
import type { DocumentType } from '@/lib/types';
import blank from '@/icons/blank.svg';
import cell from '@/icons/cell.svg';
import diagram from '@/icons/diagram.svg';
import pdf from '@/icons/pdf.svg';
import slide from '@/icons/slide.svg';
import word from '@/icons/word.svg';

/** One file per document type in `src/icons`; `blank` covers formats we cannot open. */
const ICONS: Record<DocumentType, StaticImageData> = { word, cell, slide, pdf, diagram };

export function FormatIcon({ type, size = 28 }: { type: DocumentType | null; size?: number }) {
  return (
    <Image
      src={type ? ICONS[type] : blank}
      alt=""
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    />
  );
}
