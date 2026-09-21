# @onlyoffice/create-app

Scaffold a demo application that integrates the [ONLYOFFICE Docs](https://www.onlyoffice.com/office-suite.aspx)
editors, the same way `create-next-app` scaffolds a site:

```bash
npx @onlyoffice/create-app my-app
cd my-app
# edit .env: DOCUMENT_SERVER_URL, DOCUMENT_SERVER_JWT_SECRET, APP_URL
npm start
```

The generated project is a small file manager built with **Next.js + React + TypeScript** that:

- lists, uploads, downloads and deletes files;
- creates blank `docx`, `xlsx`, `pptx` and `pdf` files from
  [ONLYOFFICE document templates](https://github.com/ONLYOFFICE/document-templates), downloaded
  over HTTPS the first time the app starts;
- asks the Document Server which formats it supports (`GET /meta/formats`) and opens each file
  either in the editor or, for read-only formats, in the viewer;
- signs the editor configuration with JWT and verifies JWT on the save callback;
- saves edited documents back to disk through the callback handler.

Everything about the Document Server connection is configured through environment variables in `.env`.
See the generated project's `README.md` for the full list and a walkthrough of the integration.

## Usage

```
npx @onlyoffice/create-app [project-directory] [options]

Options:
  --skip-install     do not install dependencies
  --use-npm          install with npm (default: the package manager that ran this command)
  --use-pnpm         install with pnpm
  --use-yarn         install with yarn
  --use-bun          install with bun
  -v, --version      print the version
  -h, --help         show help
```

Equivalent invocations: `npm init @onlyoffice/app my-app`,
`pnpm create @onlyoffice/app my-app`, `yarn create @onlyoffice/app my-app`.

The scaffolder only copies files: it creates no git repository and downloads nothing besides the
dependencies. The blank documents behind "New document" are fetched by the generated project
itself — `scripts/fetch-templates.mjs` downloads them from
[ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates) into
`document-templates/` before `npm run dev` and `npm start`, and skips the download once they are
there.

## Requirements

- Node.js 20.12 or newer.
- An ONLYOFFICE Docs (Document Server) 8.2 or newer that can reach the machine where the demo runs.
  The quickest way is Docker:
  `docker run -i -t -d -p 80:80 -e JWT_SECRET=developer-only-not-a-real-secret onlyoffice/documentserver`

## Repository layout

```
bin/create-app.js                 CLI entry point
src/                              CLI implementation (plain ESM JavaScript, no build step)
templates/default/                the demo application (a complete Next.js project)
templates/default/scripts/fetch-templates.mjs   downloads the blank documents before the app runs
scripts/smoke-test.js             runs the CLI into a temp dir and checks the result
```

This repository has no submodules and the CLI never runs git: scaffolding is a file copy plus
`npm install`. The blank documents are the app's own business — it downloads them over HTTPS on
its first start.

## Development

```bash
git clone https://github.com/ONLYOFFICE/create-app.git
cd create-app
npm install
npm test                        # smoke test of the CLI
npm run lint
```

To work on the demo application itself, run it in place:

```bash
cd templates/default
npm install
cp .env.example .env            # then edit it
npm run dev
```

The template's `node_modules`, `.next`, `.env`, lock file and uploaded files are excluded both from
git and from the npm package, and are skipped by the CLI when it copies the template.

To try the CLI end to end from a tarball:

```bash
npm pack
npx ./onlyoffice-create-app-*.tgz my-app
```

### Updating the blank templates

There is nothing in this repository to bump: `templates/default/scripts/fetch-templates.mjs`
always downloads the current state of the `main/default` branch of
[ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates). To pull newer
files locally, delete `templates/default/document-templates/` and run
`npm --prefix templates/default run fetch-templates`.
