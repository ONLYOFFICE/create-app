# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

`@onlyoffice/create-app` is an npm scaffolder (like `create-next-app`). Running
`npx @onlyoffice/create-app my-app` copies `templates/default/` into a new directory and installs its
dependencies. The result is a Next.js demo that integrates ONLYOFFICE Docs (Document Server).

There are two independent codebases here with different toolchains:

| Part         | Location                   | Language / tooling                                                                                  |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------------------- |
| CLI          | `bin/`, `src/`, `scripts/` | Plain ESM JavaScript, Node ≥ 20.12, no build step. ESLint 10 + Prettier from the root.              |
| Template app | `templates/default/`       | Next.js 16 + React 19 + TypeScript. Its own `package.json`, ESLint 9 (`eslint-config-next`), `tsc`. |

Root ESLint/Prettier ignore `templates/**`; the template is linted only from inside
its own directory. Root JS files must carry the Apache-2.0 header from
`.config/source-license-header.js` (enforced by `eslint-plugin-license-header`); template TS files
do not use it.

## Commands

Root (CLI):

```bash
npm install
npm test                 # scripts/smoke-test.js: scaffolds into a temp dir, asserts the result (offline)
npm run lint             # eslint . && prettier --check .
npm run format           # prettier --write .
npm pack --dry-run       # check what ships
```

Template app (run in place, from the root):

```bash
npm run template:install               # npm --prefix templates/default install
npm run template:dev                   # next dev (needs templates/default/.env, copy from .env.example)
                                       # its predev hook downloads the blank documents once
npm run template:build
npm --prefix templates/default run lint
npm --prefix templates/default run typecheck
```

There is a single smoke test, not a test framework; "running one test" means editing and running
`node scripts/smoke-test.js` directly. It needs no network: the CLI is invoked with
`--skip-install`, and everything else it does is a file copy.

**Neither this repository nor a generated project uses git.** The CLI runs no `git` at all — it
copies the template and installs dependencies, nothing more; making the new project a repository
is the user's own call. The blank documents behind "New document" are not shipped either: the app
downloads them itself over HTTPS before it starts (`templates/default/scripts/fetch-templates.mjs`,
see below), so `templates/default/document-templates/` is generated local state in every list that
matters.

CI (`.github/workflows/ci.yml`) runs root lint + smoke test on Ubuntu and Windows, and lints,
typechecks and builds the template app. Keep the CLI Windows-compatible (see `shell: win32` in
`src/install.js` and POSIX-normalised paths in `src/scaffold.js`).

`.github/workflows/licenses.yml` runs `ONLYOFFICE/check-licenses` (LicenseFinder) against both
`package.json`s (root and `templates/default`). Repo-specific approvals live in `.check-licenses.yml`
at the root; the template package itself is approved there because it declares no license.

## CLI architecture (`src/`)

- `cli.js` — `parseArgs` options, interactive `prompts` for the project name, orchestrates
  scaffold → install → "next steps" output. Only the final folder name is validated, so relative and
  absolute paths are accepted.
- `scaffold.js` — copies `templates/default/` with `fs.cp` and an `EXCLUDED` regex list, then
  renames `gitignore` → `.gitignore` (npm does not publish `.gitignore`), copies `.env.example` →
  `.env`, and rewrites `package.json` name/version/private.
- `install.js` — detects the package manager from `npm_config_user_agent`, spawns `<pm> install`.
- `log.js` — `util.styleText` wrapper (the reason for the Node 20.12 floor).

Three lists must stay in sync when the template gains new local-only files: `EXCLUDED` in
`src/scaffold.js`, `templates/default/.npmignore`, and the `templates/default/*` entries in the root
`.gitignore`. The smoke test's `mustExist` / `mustNotExist` arrays assert the outcome.

`storage/` is one of those local-only folders, with two exceptions that every list explicitly lets
through: `.gitkeep` and `README.md`. The latter is a copy of `templates/default/README.md` that
ships with the template, so a generated project opens with one document already in the file list
(`md` has the `lossy-edit` action, so it opens in the editor). Both copies must stay identical —
the smoke test compares them.

`templates/default/scripts/fetch-templates.mjs` is what makes the blank documents appear. It
downloads `new.{docx,xlsx,pptx,pdf}` from the `main/default` branch of
[ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates) over plain
`fetch` (that branch has one file per format and no locale folders) into
`document-templates/new/`, and is wired to the `predev` and `prestart` hooks of the template's
`package.json`. It re-downloads nothing that is already on disk, writes through a `.download`
temporary file so an interrupted run cannot leave a file that looks finished, and only warns on
failure — the app must still start. `build` deliberately has no hook: a build does not need the
documents.

`templates/default/CLAUDE.md` is the exception: it ships with the template and is copied into the
generated project, where it documents _that_ app. Keep it free of anything about this repository —
the scaffolder, the release process — and put guidance for working on the template
here instead. `next.config.ts` sets `agentRules: false` so `next dev` never overwrites it.

## Template app architecture (`templates/default/src`)

Data flow of the integration:

1. `app/editor/[fileName]/page.tsx` → `GET /api/editor-config?file=` → `lib/editor-config.ts`
   builds the editor config and signs it with JWT (`lib/jwt.ts`, HS256 via `jose`).
2. The browser loads `api.js` from `DOCUMENT_SERVER_URL` and mounts
   `@onlyoffice/document-editor-react` in `components/Editor.tsx`.
3. Document Server downloads the file from `/api/files/[name]/download` (URL built from
   `APP_URL` via `lib/public-url.ts`).
4. Document Server posts to `/api/callback?file=`; the handler verifies the JWT (body `token` or
   the `DOCUMENT_SERVER_JWT_HEADER` header), and on status 2/6 downloads the saved file and writes
   it atomically (`lib/storage.ts`).

Key decisions worth knowing before editing:

- **Formats come from the server.** `lib/formats.ts` fetches `GET <server>/meta/formats`
  (cached, falls back to `lib/fallback-formats.json` on 404). `decideOpen()` maps the format's
  `actions` (`edit` / `lossy-edit` / `view`) to editor mode; unknown formats cannot be uploaded.
- **Two Document Server URLs.** `DOCUMENT_SERVER_URL` is what the browser uses;
  `DOCUMENT_SERVER_INTERNAL_URL` is what the app uses server-side (Docker networks). The callback
  handler rewrites the download URL prefix accordingly.
- **Document key** (`lib/document-key.ts`) is derived from name + size + mtime, so no database is
  needed; it changes automatically after each save.
- **Config** is read once by `lib/env.ts` (`loadEnv` / `requireEnv`); missing config surfaces as a
  503 `EnvError` through `lib/http.ts`'s `handleRoute` wrapper, which every API route uses.
- **Blank documents** for "New document" come from `document-templates/new/new.<type>`, resolved
  by `lib/document-templates.ts` — one file per format, no locales, downloaded by
  `scripts/fetch-templates.mjs` before the app starts. Only "New document" depends on them.

## Release process

Version lives in `package.json` and the top entry of `CHANGELOG.md` (the `## x.y.z` heading is what
`create-tag.yml` and `release.yml` parse). A push to `master` creates the `vX.Y.Z` tag; the tag
triggers `npm publish --provenance` and a GitHub release whose body is the first changelog section.
Development happens on `develop`.
