'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TemplateType } from '@/lib/types';
import styles from './CreateDialog.module.css';

const OPTIONS: { type: TemplateType; label: string; defaultName: string }[] = [
  { type: 'docx', label: 'Document (.docx)', defaultName: 'New document' },
  { type: 'xlsx', label: 'Spreadsheet (.xlsx)', defaultName: 'New spreadsheet' },
  { type: 'pptx', label: 'Presentation (.pptx)', defaultName: 'New presentation' },
  { type: 'pdf', label: 'PDF form (.pdf)', defaultName: 'New PDF form' },
];

type Props = {
  open: boolean;
  initialType: TemplateType;
  busy: boolean;
  onClose: () => void;
  onCreate: (type: TemplateType, name: string) => void;
};

export function CreateDialog({ open, initialType, busy, onClose, onCreate }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<TemplateType>(initialType);
  const [name, setName] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setType(initialType);
      setName(OPTIONS.find((o) => o.type === initialType)?.defaultName ?? '');
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.select());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialType]);

  const handleTypeChange = (next: TemplateType) => {
    const previousDefault = OPTIONS.find((o) => o.type === type)?.defaultName;
    setType(next);
    if (!name.trim() || name === previousDefault) {
      setName(OPTIONS.find((o) => o.type === next)?.defaultName ?? '');
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    onCreate(type, name.trim());
  };

  return (
    <dialog ref={dialogRef} onClose={onClose} className={styles.dialog}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <h2 className={styles.heading}>Create a new file</h2>

        <label className={styles.label}>
          Type
          <select
            className="input"
            value={type}
            onChange={(event) => handleTypeChange(event.target.value as TemplateType)}
          >
            {OPTIONS.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.label}>
          Name
          <input
            ref={inputRef}
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={OPTIONS.find((o) => o.type === type)?.defaultName}
            maxLength={150}
          />
        </label>

        <div className={styles.actions}>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create and open'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
