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

/**
 * Smoke test: runs the CLI into a temporary directory (without installing dependencies)
 * and checks that the scaffolded project looks right.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/create-app.js', import.meta.url));

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', ...options });
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'create-app-'));
try {
  // --help / --version
  const help = runCli(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: npx @onlyoffice\/create-app/);
  const version = runCli(['--version']);
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+/);

  // Scaffold into a relative path.
  const result = runCli(['My Demo App', '--skip-install'], { cwd: tmp });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Done!/);

  const target = path.join(tmp, 'My Demo App');
  const mustExist = [
    'package.json',
    '.gitignore',
    '.env',
    '.env.example',
    'README.md',
    'next.config.ts',
    'tsconfig.json',
    'eslint.config.mjs',
    'src/app/page.tsx',
    'src/app/layout.tsx',
    'src/app/editor/[fileName]/page.tsx',
    'src/app/api/files/route.ts',
    'src/app/api/callback/route.ts',
    'src/app/api/editor-config/route.ts',
    'src/lib/editor-config.ts',
    'src/lib/jwt.ts',
    'document-templates/en-US/new.docx',
    'document-templates/en-US/new.xlsx',
    'document-templates/en-US/new.pptx',
    'document-templates/en-US/new.pdf',
    'document-templates/default/new.docx',
    'document-templates/ru-RU/new.docx',
    'document-templates/LICENSE',
    'storage/.gitkeep',
  ];
  for (const file of mustExist) {
    assert.ok(existsSync(path.join(target, file)), `missing ${file}`);
  }
  const mustNotExist = [
    'gitignore',
    'node_modules',
    '.next',
    'next-env.d.ts',
    'AGENTS.md',
    'CLAUDE.md',
  ];
  for (const file of mustNotExist) {
    assert.ok(!existsSync(path.join(target, file)), `unexpected ${file}`);
  }

  const pkg = JSON.parse(await fs.readFile(path.join(target, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'my-demo-app');
  assert.equal(pkg.private, true);
  assert.equal(pkg.version, '0.1.0');
  assert.equal(pkg.scripts.start, 'next build && next start');
  assert.ok(pkg.dependencies['@onlyoffice/document-editor-react']);

  const env = await fs.readFile(path.join(target, '.env'), 'utf8');
  const envExample = await fs.readFile(path.join(target, '.env.example'), 'utf8');
  assert.equal(env, envExample);
  assert.match(env, /^DOCUMENT_SERVER_URL=/m);
  assert.match(env, /^DOCUMENT_SERVER_JWT_SECRET=/m);
  assert.match(env, /^APP_URL=/m);

  const gitignore = await fs.readFile(path.join(target, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\/storage\/\*$/m);

  // Only files from storage/.gitkeep are allowed in storage.
  assert.deepEqual(await fs.readdir(path.join(target, 'storage')), ['.gitkeep']);

  // A second run into the same non-empty directory must fail.
  const again = runCli([target, '--skip-install']);
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /already contains files/);

  // Conflicting package manager flags must fail.
  const conflict = runCli([path.join(tmp, 'other'), '--use-npm', '--use-pnpm', '--skip-install']);
  assert.notEqual(conflict.status, 0);
  assert.ok(!existsSync(path.join(tmp, 'other')));

  console.log('Smoke test passed');
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
