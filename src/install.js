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

export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];

/** Detects the package manager that launched this CLI (`npx`, `pnpm dlx`, `yarn create`, `bunx`). */
export function detectPackageManager() {
  const agent = process.env.npm_config_user_agent ?? '';
  for (const manager of PACKAGE_MANAGERS) {
    if (agent.startsWith(`${manager}/`)) return manager;
  }
  return 'npm';
}

/** Runs `<manager> install` in `cwd`, streaming its output to the terminal. */
export function runInstall(manager, cwd) {
  if (!PACKAGE_MANAGERS.includes(manager)) {
    throw new Error(`Unsupported package manager "${manager}"`);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(manager, ['install'], {
      cwd,
      stdio: 'inherit',
      // npm/pnpm/yarn are .cmd shims on Windows and cannot be spawned without a shell.
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${manager} install exited with code ${code}`));
    });
  });
}

/** Command that runs a package.json script with the given manager. */
export function runScriptCommand(manager, script) {
  switch (manager) {
    case 'yarn':
      return `yarn ${script}`;
    case 'pnpm':
      return `pnpm ${script}`;
    case 'bun':
      return `bun run ${script}`;
    default:
      return `npm ${script === 'start' || script === 'test' ? script : `run ${script}`}`;
  }
}
