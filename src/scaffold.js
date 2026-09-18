/**
 *
 * (c) Copyright Ascensio System SIA 2026
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEMPLATE_DIR = fileURLToPath(new URL('../templates/default/', import.meta.url));

/**
 * Paths (relative to the template root, POSIX separators) that must never be copied.
 * They only exist when the template has been run in place during development, where it is set
 * up as its own git repository (`npm run template:setup`): `.git`, `.gitmodules` and the
 * `document-templates` submodule all belong to that repository. The generated project gets its
 * own, created by `src/git.js`.
 */
const EXCLUDED = [
  /^\.git(\/|$)/,
  /^\.gitmodules$/,
  /^document-templates(\/|$)/,
  /^node_modules(\/|$)/,
  /^\.next(\/|$)/,
  /^out(\/|$)/,
  /^\.env$/,
  /^\.env\.local$/,
  /^next-env\.d\.ts$/,
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb?$/,
  /\.tsbuildinfo$/,
  /^storage\/(?!\.gitkeep$|README\.md$).+/,
  /^AGENTS\.md$/,
  /^\.npmignore$/,
];

/** Files whose content is irrelevant for the "directory is empty" check. */
const IGNORED_IN_TARGET = new Set([
  '.git',
  '.gitignore',
  '.gitattributes',
  '.DS_Store',
  'Thumbs.db',
  'README.md',
  'LICENSE',
]);

/** Converts a folder name to a valid package.json name. */
export function toPackageName(folderName) {
  const name = folderName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 214);
  return name || 'docs-integration-demo';
}

/** Throws if `targetDir` exists and contains anything besides a few harmless files. */
export async function assertTargetDir(targetDir) {
  let entries;
  try {
    entries = await fs.readdir(targetDir);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const conflicts = entries.filter((entry) => !IGNORED_IN_TARGET.has(entry));
  if (conflicts.length > 0) {
    throw new Error(
      `The directory ${targetDir} already contains files:\n  ${conflicts.slice(0, 10).join('\n  ')}` +
        (conflicts.length > 10 ? `\n  …and ${conflicts.length - 10} more` : '') +
        '\nChoose a different project name or empty the directory first.',
    );
  }
}

/**
 * Copies the template into `targetDir` and adjusts it for a fresh project:
 * `gitignore` → `.gitignore` (npm does not publish dotfiles named .gitignore),
 * `.env.example` → `.env`, package.json name/version.
 */
export async function scaffold({ targetDir, packageName }) {
  await fs.mkdir(targetDir, { recursive: true });

  await fs.cp(TEMPLATE_DIR, targetDir, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(TEMPLATE_DIR, source).split(path.sep).join('/');
      if (!relative) return true;
      return !EXCLUDED.some((pattern) => pattern.test(relative));
    },
  });

  await fs.rename(path.join(targetDir, 'gitignore'), path.join(targetDir, '.gitignore'));
  await fs.copyFile(path.join(targetDir, '.env.example'), path.join(targetDir, '.env'));
  await fs.mkdir(path.join(targetDir, 'storage'), { recursive: true });

  const packageJsonPath = path.join(targetDir, 'package.json');
  const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  pkg.name = packageName;
  pkg.version = '0.1.0';
  pkg.private = true;
  await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
