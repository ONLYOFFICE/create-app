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
 * Copies blank document templates from the `vendor/document-templates` git submodule
 * (https://github.com/ONLYOFFICE/document-templates, folder `new/<locale>/`) into
 * `templates/default/document-templates/<locale>/` so that they ship inside the npm package
 * and end up in every scaffolded application.
 *
 * Run automatically by `npm pack` / `npm publish` (prepack hook) and by `npm test`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const vendorDir = path.join(root, 'vendor', 'document-templates');
const sourceDir = path.join(vendorDir, 'new');
const destDir = path.join(root, 'templates', 'default', 'document-templates');
const TEMPLATE_FILES = ['new.docx', 'new.xlsx', 'new.pptx', 'new.pdf'];

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let locales;
  try {
    locales = (await fs.readdir(sourceDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    throw new Error(
      `Cannot read ${sourceDir}.\nThe git submodule is missing or empty. Run:\n\n  git submodule update --init\n`,
    );
  }
  if (locales.length === 0) {
    throw new Error(`No locale folders found in ${sourceDir}`);
  }

  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });

  let copied = 0;
  for (const locale of locales) {
    const localeDest = path.join(destDir, locale);
    await fs.mkdir(localeDest, { recursive: true });
    for (const file of TEMPLATE_FILES) {
      const from = path.join(sourceDir, locale, file);
      if (await exists(from)) {
        await fs.copyFile(from, path.join(localeDest, file));
        copied += 1;
      }
    }
  }

  // Keep the upstream license next to the copied templates.
  const license = path.join(vendorDir, 'LICENSE');
  if (await exists(license)) {
    await fs.copyFile(license, path.join(destDir, 'LICENSE'));
  }

  for (const required of ['en-US', 'default']) {
    if (!(await exists(path.join(destDir, required, 'new.docx')))) {
      throw new Error(`Required locale "${required}" is missing after sync`);
    }
  }

  console.log(`Synced ${copied} template files for ${locales.length} locales into ${destDir}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
