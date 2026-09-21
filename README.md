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
  [ONLYOFFICE document templates](https://github.com/ONLYOFFICE/document-templates) (48 locales),
  shipped with the project;
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
dependencies. The blank documents behind "New document"
([ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates)) are part of the
template and land in `document-templates/` of the new project.

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
templates/default/document-templates/   blank documents behind "New document"
scripts/smoke-test.js             runs the CLI into a temp dir and checks the result
```

This repository has no submodules: everything the generated project needs is a plain file of the
template, so scaffolding works offline and without git.

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

`templates/default/document-templates/` is a copy of
[ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates). To refresh it,
replace its contents with a newer checkout of that repository and commit the result.

## License

Apache-2.0. Blank document templates are © Ascensio System SIA, Apache-2.0,
from [ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates).
