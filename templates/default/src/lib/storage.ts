/**
 * File storage on the local file system. All public functions accept a bare file name and
 * refuse anything that could escape the storage folder.
 */
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { requireEnv } from './env';
import { BadRequest, NotFound } from './http';
import type { FileInfo } from './types';

// Printable characters except the ones forbidden in Windows file names; 1..200 chars.
const NAME_RE = /^[^\\/:*?"<>|\x00-\x1f]{1,200}$/;

/** Validates a user-supplied file name and strips any directory part. */
export function safeName(input: unknown): string {
  const base = path.basename(String(input ?? '').replace(/\\/g, '/')).trim();
  if (!base || base === '.' || base === '..' || base.startsWith('.') || !NAME_RE.test(base)) {
    throw new BadRequest('Invalid file name');
  }
  return base;
}

/** Lower-case extension without a dot, or empty string. */
export function extOf(fileName: string): string {
  return path.extname(fileName).slice(1).toLowerCase();
}

function storageDir(): string {
  return requireEnv().storageDir;
}

/** Absolute path of a file inside the storage folder (the file may not exist yet). */
export function resolveInStorage(name: string): string {
  const dir = path.resolve(storageDir());
  const full = path.resolve(dir, safeName(name));
  if (path.dirname(full) !== dir) {
    throw new BadRequest('Invalid file path');
  }
  return full;
}

export async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(storageDir(), { recursive: true });
}

export async function listFiles(): Promise<FileInfo[]> {
  await ensureStorageDir();
  const entries = await fs.readdir(storageDir(), { withFileTypes: true });
  const files: FileInfo[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.') || entry.name.endsWith('.tmp')) continue;
    try {
      files.push(await statFile(entry.name));
    } catch {
      // Ignore files with unusable names or files that vanished meanwhile.
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
}

export async function statFile(name: string): Promise<FileInfo> {
  const full = resolveInStorage(name);
  let stat;
  try {
    stat = await fs.stat(full);
  } catch {
    throw new NotFound(`File "${name}" not found`);
  }
  if (!stat.isFile()) throw new NotFound(`File "${name}" not found`);
  return {
    name: path.basename(full),
    size: stat.size,
    modified: stat.mtime.toISOString(),
    mtimeMs: stat.mtimeMs,
  };
}

export async function fileExists(name: string): Promise<boolean> {
  try {
    await fs.access(resolveInStorage(name));
    return true;
  } catch {
    return false;
  }
}

/** Returns `name`, or `name (1)`, `name (2)`, … if the name is already taken. */
export async function uniqueName(desired: string): Promise<string> {
  const { name: stem, ext } = path.parse(safeName(desired));
  for (let i = 0; ; i += 1) {
    const candidate = i === 0 ? `${stem}${ext}` : `${stem} (${i})${ext}`;
    if (!(await fileExists(candidate))) return candidate;
  }
}

/**
 * Writes the content to a temporary file first and renames it into place, so that a
 * concurrent download (e.g. the Document Server re-fetching the file) never sees a
 * half-written document.
 */
export async function writeFileAtomic(
  name: string,
  data: Uint8Array | ReadableStream<Uint8Array> | Readable,
): Promise<void> {
  await ensureStorageDir();
  const target = resolveInStorage(name);
  const temp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    if (data instanceof Readable) {
      await pipeline(data, createWriteStream(temp));
    } else if (data instanceof ReadableStream) {
      await pipeline(Readable.fromWeb(data as never), createWriteStream(temp));
    } else {
      await fs.writeFile(temp, data);
    }
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function openReadStream(name: string) {
  return createReadStream(resolveInStorage(name));
}

export async function copyIntoStorage(sourcePath: string, name: string): Promise<void> {
  await ensureStorageDir();
  await fs.copyFile(sourcePath, resolveInStorage(name));
}

export async function deleteFile(name: string): Promise<void> {
  const full = resolveInStorage(name);
  try {
    await fs.unlink(full);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new NotFound(`File "${name}" not found`);
    }
    throw error;
  }
}
