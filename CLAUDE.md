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

Root ESLint/Prettier ignore `templates/**` and `vendor/**`; the template is linted only from inside
its own directory. Root JS files must carry the Apache-2.0 header from
`.config/source-license-header.js` (enforced by `eslint-plugin-license-header`); template TS files
do not use it.

## Commands

Root (CLI):

```bash
npm install
npm run sync-templates   # copy blank documents from the submodule into templates/default/document-templates
npm test                 # sync-templates + scripts/smoke-test.js (scaffolds into a temp dir, asserts the result)
npm run lint             # eslint . && prettier --check .
npm run format           # prettier --write .
npm pack --dry-run       # check what ships; prepack runs sync-templates
```

Template app (run in place, from the root):

```bash
npm run template:install               # npm --prefix templates/default install
npm run template:dev                   # next dev (needs templates/default/.env, copy from .env.example)
npm run template:build
npm --prefix templates/default run lint
npm --prefix templates/default run typecheck
```

There is a single smoke test, not a test framework; "running one test" means editing and running
`node scripts/smoke-test.js` directly. It requires `templates/default/document-templates/` to exist,
so run `npm run sync-templates` first (or `npm test`, which does it).

The submodule `vendor/document-templates` must be checked out (`git submodule update --init`)
or `sync-templates` fails. `templates/default/document-templates/` is generated and git-ignored.

CI (`.github/workflows/ci.yml`) runs root lint + smoke test on Ubuntu and Windows, and lints,
typechecks and builds the template app. Keep the CLI Windows-compatible (see `shell: win32` in
`src/install.js` and POSIX-normalised paths in `src/scaffold.js`).

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
- **Blank documents** for "New document" come from `document-templates/<locale>/new.{docx,xlsx,pptx,pdf}`,
  resolved by `lib/document-templates.ts` (exact locale → language prefix → `default` → `en-US`).

## Release process

Version lives in `package.json` and the top entry of `CHANGELOG.md` (the `## x.y.z` heading is what
`create-tag.yml` and `release.yml` parse). A push to `master` creates the `vX.Y.Z` tag; the tag
triggers `npm publish --provenance` and a GitHub release whose body is the first changelog section.
Development happens on `develop`.
