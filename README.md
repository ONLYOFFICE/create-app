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
  attached to the generated project as a git submodule;
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
  --skip-git         do not create a git repository and do not attach the
                     blank document templates submodule
  --use-npm          install with npm (default: the package manager that ran this command)
  --use-pnpm         install with pnpm
  --use-yarn         install with yarn
  --use-bun          install with bun
  -v, --version      print the version
  -h, --help         show help
```

Equivalent invocations: `npm init @onlyoffice/app my-app`,
`pnpm create @onlyoffice/app my-app`, `yarn create @onlyoffice/app my-app`.

The scaffolder initializes a git repository in the new directory and attaches
[ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates) to it as a
submodule at `document-templates/` — those are the blank files behind "New document". When git is
unavailable, the network is down or `--skip-git` was given, everything else still works and the CLI
prints the command to attach them later.

## Requirements

- Node.js 20.12 or newer.
- git, for the blank documents submodule of the generated project (optional: see `--skip-git`).
- An ONLYOFFICE Docs (Document Server) 8.2 or newer that can reach the machine where the demo runs.
  The quickest way is Docker:
  `docker run -i -t -d -p 80:80 -e JWT_SECRET=developer-only-not-a-real-secret onlyoffice/documentserver`

## Repository layout

```
bin/create-app.js                 CLI entry point
src/                              CLI implementation (plain ESM JavaScript, no build step)
src/git.js                        git init + "git submodule add" for the blank documents
templates/default/                the demo application (a complete Next.js project)
scripts/setup-template-repo.js    sets templates/default up as its own git repository, the way
                                  a generated project is (npm run template:setup)
scripts/smoke-test.js             runs the CLI into a temp dir and checks the result
```

This repository has no submodules. The blank documents are attached by git at the moment a project
is created, and `npm run template:setup` does the same thing to `templates/default` so that the app
developed in place is set up exactly like the one users get:

```
templates/default/.git/           nested repository, created by npm run template:setup
templates/default/.gitmodules     its submodule declaration
templates/default/document-templates/   the submodule itself → ONLYOFFICE/document-templates
```

## Development

```bash
git clone https://github.com/ONLYOFFICE/create-app.git
cd create-app
npm install
npm run template:setup          # once: makes templates/default a git repo with the submodule
npm test                        # smoke test of the CLI (offline)
CREATE_APP_TEST_GIT=1 npm test  # also scaffolds with git and checks the submodule (needs network)
npm run lint
```

To work on the demo application itself, run it in place:

```bash
cd templates/default
npm install
cp .env.example .env            # then edit it
npm run dev
```

Note that `templates/default` is a git repository of its own after `template:setup`, so `git` run
from inside it talks to that repository, not to this one. Commit the template's sources from the
repository root as usual.

The template's `node_modules`, `.next`, `.env`, lock file and uploaded files are excluded both from
git and from the npm package, and are skipped by the CLI when it copies the template. So are the
nested repository, its `.gitmodules` and `document-templates`: the generated project builds its
own.

To try the CLI end to end from a tarball:

```bash
npm pack
npx ./onlyoffice-create-app-*.tgz my-app
```

### Updating the blank templates

A generated project always clones the templates fresh from `master`, so there is no pointer in this
repository to bump. To refresh the copy used during development:

```bash
git -C templates/default submodule update --remote document-templates
```

## License

Apache-2.0. Blank document templates are © Ascensio System SIA, Apache-2.0,
from [ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates).
