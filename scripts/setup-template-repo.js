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
 * Sets up `templates/default` for development the same way `@onlyoffice/create-app` sets up a
 * generated project: its own git repository with the blank documents attached as the
 * `document-templates` submodule. It runs through `src/git.js`, so what a contributor works on
 * in place is what a user ends up with.
 *
 * The nested repository, its `.gitmodules` and the submodule are ignored by this repository.
 * Re-running the script is safe: an existing setup is only refreshed.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGitAvailable, setupRepository, TEMPLATES_SUBMODULE } from '../src/git.js';

const templateDir = fileURLToPath(new URL('../templates/default/', import.meta.url));

if (!(await isGitAvailable())) {
  console.error('git was not found on PATH, but it is required to set the template app up.');
  process.exit(1);
}

const { initialized, reused, committed } = await setupRepository(templateDir, {
  // templates/default sits inside this repository, so the nested one has to be forced.
  alwaysInit: true,
  // During development the template's ignore file is still called `gitignore`; without it the
  // first commit would swallow node_modules, .next and a real .env.
  excludeFrom: 'gitignore',
  message: 'Template app, set up for development by npm run template:setup',
});

const where = path.relative(process.cwd(), path.join(templateDir, TEMPLATES_SUBMODULE.path));
if (reused) console.log(`Refreshed the existing ${where} submodule`);
else if (initialized) console.log(`Initialized a git repository and attached ${where}`);
else console.log(`Attached ${where}`);
if (initialized && !reused && !committed) {
  console.log('Nothing was committed: configure git user.name and user.email to commit.');
}
