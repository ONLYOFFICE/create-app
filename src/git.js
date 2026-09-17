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

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

/** The blank documents used by "New document" are a git submodule of the generated project. */
export const TEMPLATES_SUBMODULE = {
  url: 'https://github.com/ONLYOFFICE/document-templates',
  path: 'document-templates',
  branch: 'master',
};

/** Command a user has to run by hand when the CLI could not set the submodule up. */
export const ADD_SUBMODULE_COMMAND = [
  'git init',
  `git submodule add -b ${TEMPLATES_SUBMODULE.branch} ${TEMPLATES_SUBMODULE.url} ${TEMPLATES_SUBMODULE.path}`,
].join(' && ');

/**
 * Runs git in `cwd`. Resolves with the trimmed stdout, rejects with the stderr of a failed run.
 * Output is captured, not inherited: cloning the templates should not bury the CLI's own log.
 */
function git(args, cwd) {
  return new Promise((resolve, reject) => {
    // No `shell` option: git is a real executable on every platform, so the arguments
    // (including the submodule URL) are passed through without going near a shell.
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `git ${args[0]} exited with code ${code}`));
    });
  });
}

/** True when a usable `git` is on PATH. */
export async function isGitAvailable() {
  try {
    await git(['--version']);
    return true;
  } catch {
    return false;
  }
}

/** True when `dir` already belongs to a git working tree (scaffolding inside an existing repo). */
export async function isInsideRepository(dir) {
  try {
    return (await git(['rev-parse', '--is-inside-work-tree'], dir)) === 'true';
  } catch {
    return false;
  }
}

/** True when `dir` is the root of a git repository of its own. */
async function isRepositoryRoot(dir) {
  try {
    await fs.stat(path.join(dir, '.git'));
    return true;
  } catch {
    return false;
  }
}

/** True when the templates submodule is already registered in `dir`'s index. */
async function hasTemplatesSubmodule(dir) {
  try {
    const entry = await git(['ls-files', '--stage', '--', TEMPLATES_SUBMODULE.path], dir);
    return entry.startsWith('160000 ');
  } catch {
    return false;
  }
}

/**
 * Seeds `.git/info/exclude` with the patterns of `ignoreFile`. Used when the repository is
 * created around a working tree whose ignore rules are not in place yet, so that the first
 * `git add` cannot swallow `node_modules`, a build folder or a `.env` with real secrets.
 */
async function seedExcludes(dir, ignoreFile) {
  const patterns = await fs.readFile(path.join(dir, ignoreFile), 'utf8');
  const target = path.join(dir, '.git', 'info', 'exclude');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(
    target,
    `${patterns.trimEnd()}
`,
  );
}

/**
 * Turns `targetDir` into a git repository and attaches the blank document templates as a
 * submodule. This is the one code path behind both a generated project and the template app
 * during development, so the two are set up identically.
 *
 * Options:
 * - `alwaysInit` — create a repository even when `targetDir` already sits inside one. Without it
 *   the submodule would land in the surrounding repository instead.
 * - `excludeFrom` — an ignore file inside `targetDir` to seed `.git/info/exclude` from, for a
 *   working tree whose `.gitignore` is not named `.gitignore` yet.
 * - `message` — commit message for the initial commit.
 *
 * Returns what was actually done. Throws only when the submodule could not be attached — that is
 * the part the application needs to work.
 */
export async function setupRepository(targetDir, options = {}) {
  const {
    alwaysInit = false,
    excludeFrom,
    message = 'Initial commit from @onlyoffice/create-app',
  } = options;

  const own = await isRepositoryRoot(targetDir);
  const inside = own || (!alwaysInit && (await isInsideRepository(targetDir)));
  if (!inside) await git(['init', '--quiet'], targetDir);

  const ownRepository = own || !inside;
  if (ownRepository && excludeFrom) await seedExcludes(targetDir, excludeFrom);

  // Re-running must not fail: an already registered submodule only needs its files back.
  const attached = await hasTemplatesSubmodule(targetDir);
  if (attached) {
    await git(['submodule', 'update', '--init', '--', TEMPLATES_SUBMODULE.path], targetDir);
  } else {
    await git(
      [
        'submodule',
        'add',
        '--quiet',
        '-b',
        TEMPLATES_SUBMODULE.branch,
        TEMPLATES_SUBMODULE.url,
        TEMPLATES_SUBMODULE.path,
      ],
      targetDir,
    );
  }

  // A repository of our own is left with a commit so that the submodule pointer is recorded;
  // inside somebody else's repository the commit is the user's call.
  let committed = false;
  if (ownRepository && !attached) {
    try {
      await git(['add', '--all'], targetDir);
      await git(['commit', '--quiet', '-m', message], targetDir);
      committed = true;
    } catch {
      // Usually "please tell me who you are": user.name / user.email are not configured.
      committed = false;
    }
  }

  return { initialized: !inside, reused: attached, committed };
}
