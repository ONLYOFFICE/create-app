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
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { detectPackageManager, PACKAGE_MANAGERS, runInstall, runScriptCommand } from './install.js';
import { log } from './log.js';
import { assertTargetDir, scaffold, toPackageName } from './scaffold.js';

const HELP = `
Usage: npx @onlyoffice/create-app [project-directory] [options]

Creates a demo application that integrates ONLYOFFICE Docs (Document Server):
a small file manager built with Next.js that uploads, creates, opens and deletes
documents in the ONLYOFFICE editors.

Options:
  --skip-install     do not install dependencies
  --use-npm        install with npm  (default: the package manager that ran this command)
  --use-pnpm         install with pnpm
  --use-yarn         install with yarn
  --use-bun          install with bun
  -v, --version      print the version of this tool
  -h, --help         show this help

After the project is created:
  1. edit .env and point it at your Document Server
  2. run "npm start" and open http://localhost:3000
`;

async function readVersion() {
  const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  return pkg.version;
}

function pickPackageManager(values) {
  const chosen = PACKAGE_MANAGERS.filter((manager) => values[`use-${manager}`]);
  if (chosen.length > 1)
    throw new Error(`Only one of ${chosen.map((m) => `--use-${m}`).join(', ')} can be given`);
  return chosen[0] ?? detectPackageManager();
}

function validateProjectName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'Please enter a project name';
  // Only the final folder name is checked, so relative and absolute paths are allowed.
  // Rejected: characters invalid in directory names on Windows and control characters.
  const folder = path.basename(trimmed.replace(/[\\/]+$/, ''));
  if (!folder || /[<>:"|?*]/.test(folder) || /\p{Cc}/u.test(folder)) {
    return 'The name contains characters that are not allowed in a path';
  }
  return true;
}

async function askProjectName() {
  const { name } = await prompts(
    {
      type: 'text',
      name: 'name',
      message: 'Project directory',
      initial: 'my-docs-integration',
      validate: validateProjectName,
    },
    {
      onCancel: () => {
        throw new Error('Cancelled');
      },
    },
  );
  return name.trim();
}

export async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'skip-install': { type: 'boolean', default: false },
      'use-npm': { type: 'boolean', default: false },
      'use-pnpm': { type: 'boolean', default: false },
      'use-yarn': { type: 'boolean', default: false },
      'use-bun': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  });

  if (values.help) {
    console.log(HELP.trimStart());
    return;
  }
  if (values.version) {
    console.log(await readVersion());
    return;
  }
  if (positionals.length > 1) {
    throw new Error(`Unexpected arguments: ${positionals.slice(1).join(' ')}\n${HELP}`);
  }

  const packageManager = pickPackageManager(values);

  let projectArg = positionals[0];
  if (projectArg !== undefined) {
    const problem = validateProjectName(projectArg);
    if (problem !== true) throw new Error(problem);
  } else {
    projectArg = await askProjectName();
  }

  const targetDir = path.resolve(process.cwd(), projectArg);
  const projectName = path.basename(targetDir);
  const packageName = toPackageName(projectName);

  console.log();
  log.info(
    `${log.bold('ONLYOFFICE Docs – Integration Demo')} ${log.dim(`v${await readVersion()}`)}`,
  );
  console.log();

  await assertTargetDir(targetDir);

  log.step(`Creating the project in ${log.bold(targetDir)}`);
  await scaffold({ targetDir, packageName });
  log.success('Project files copied');

  let installed = false;
  if (values['skip-install']) {
    log.info(`${log.dim('Skipping dependency installation (--skip-install)')}`);
  } else {
    log.step(`Installing dependencies with ${log.bold(packageManager)}…`);
    console.log();
    try {
      await runInstall(packageManager, targetDir);
      installed = true;
      console.log();
      log.success('Dependencies installed');
    } catch (error) {
      console.log();
      log.warn(`Dependency installation failed: ${error.message}`);
      log.warn(`Run "${packageManager} install" inside the project manually.`);
    }
  }

  printNextSteps({ targetDir, packageManager, installed });
}

function printNextSteps({ targetDir, packageManager, installed }) {
  const relative = path.relative(process.cwd(), targetDir) || '.';
  const cdPath = /\s/.test(relative) ? `"${relative}"` : relative;

  console.log();
  log.success(`Done! The demo application is ready in ${log.bold(relative)}`);
  console.log();
  log.info('Next steps:');
  console.log();
  log.info(`  ${log.cmd(`cd ${cdPath}`)}`);
  if (!installed) log.info(`  ${log.cmd(`${packageManager} install`)}`);
  log.info(
    `  ${log.dim('# edit .env: set DOCUMENT_SERVER_URL, DOCUMENT_SERVER_JWT_SECRET and APP_URL')}`,
  );
  log.info(`  ${log.cmd(runScriptCommand(packageManager, 'start'))}`);
  console.log();
  log.info(`Then open ${log.cmd('http://localhost:3000')} in your browser.`);
  log.info(
    log.dim(
      'The Document Server must be able to reach APP_URL to download files and save changes.',
    ),
  );
  console.log();
}
