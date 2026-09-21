/**
 * Downloads the blank documents behind "New document" into ./document-templates/new.
 *
 * They come from the `main/default` branch of
 * https://github.com/ONLYOFFICE/document-templates, which holds exactly one blank file per
 * format and no locale folders. Plain HTTPS, no git and no dependencies.
 *
 * The script runs before `npm run dev` and `npm start` (the "predev" / "prestart" hooks) and
 * downloads only what is missing, so starting the app a second time costs four `stat` calls.
 * A failure is never fatal: only "New document" needs these files, everything else works
 * without them.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BRANCH = 'main/default';
const BASE_URL = `https://raw.githubusercontent.com/ONLYOFFICE/document-templates/${BRANCH}/new`;
const TYPES = ['docx', 'xlsx', 'pptx', 'pdf'];

// Resolved from this file, not from the current directory, so the script works from anywhere.
const targetDir = fileURLToPath(new URL('../document-templates/new/', import.meta.url));

/** A template counts as downloaded when the file exists and is not empty. */
async function isPresent(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function download(type) {
  const url = `${BASE_URL}/new.${type}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status} ${response.statusText}`);
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.length === 0) throw new Error(`${url} → empty response`);

  // Write next to the target and rename: an interrupted run must not leave behind a partial
  // file that the next one would take for a finished download.
  const file = path.join(targetDir, `new.${type}`);
  const temp = `${file}.download`;
  await fs.writeFile(temp, body);
  await fs.rename(temp, file);
  return body.length;
}

const missing = [];
for (const type of TYPES) {
  if (!(await isPresent(path.join(targetDir, `new.${type}`)))) missing.push(type);
}

if (missing.length === 0) {
  console.log('Blank templates are already in document-templates/new, nothing to download.');
  process.exit(0);
}

await fs.mkdir(targetDir, { recursive: true });
console.log(`Downloading blank templates (${missing.join(', ')}) from ${BASE_URL}`);

const failures = [];
for (const type of missing) {
  try {
    const size = await download(type);
    console.log(`  new.${type} — ${(size / 1024).toFixed(1)} kB`);
  } catch (error) {
    failures.push(`new.${type}: ${error.message}`);
  }
}

if (failures.length > 0) {
  console.warn('Could not download the blank templates:');
  for (const failure of failures) console.warn(`  ${failure}`);
  console.warn('"New document" stays unavailable until "npm run fetch-templates" succeeds.');
}
