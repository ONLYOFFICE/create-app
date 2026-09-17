# ONLYOFFICE Docs integration demo

A small file manager built with [Next.js](https://nextjs.org/) that shows how to integrate the
[ONLYOFFICE Docs](https://www.onlyoffice.com/office-suite.aspx) editors into a web application:

- list, upload, download and delete files;
- create blank documents, spreadsheets, presentations and PDF forms from templates;
- open files in the ONLYOFFICE editor for editing, or in the viewer when the format is read-only;
- save changes back through the Document Server callback, protected with JWT.

The project was generated with [`@onlyoffice/create-app`](https://www.npmjs.com/package/@onlyoffice/create-app).

## Requirements

- Node.js 20.12 or newer;
- git, because the blank documents are a submodule (see below);
- a running ONLYOFFICE Docs (Document Server) 8.2 or newer, for example
  [in Docker](https://helpcenter.onlyoffice.com/installation/docs-community-install-docker.aspx):

  ```bash
  docker run -i -t -d -p 8080:80 --restart=always \
    -e JWT_SECRET=my_jwt_secret onlyoffice/documentserver
  ```

## Getting started

1. Edit `.env` (it was created from `.env.example`):

   | Variable | Meaning |
   | --- | --- |
   | `DOCUMENT_SERVER_URL` | URL of the Document Server **as seen from the browser**, e.g. `http://localhost:8080/`. Required. |
   | `DOCUMENT_SERVER_INTERNAL_URL` | URL of the Document Server as seen from this app (server side). Only needed when it differs, e.g. inside Docker networks. |
   | `DOCUMENT_SERVER_JWT_SECRET` | JWT secret of the Document Server (`JWT_SECRET` for Docker, `services.CoAuthoring.secret.*` in `local.json`). Leave empty only when JWT is disabled. |
   | `DOCUMENT_SERVER_JWT_HEADER` | Header the Document Server uses for JWT, `Authorization` by default. |
   | `APP_URL` | URL of **this app as seen from the Document Server**. The Document Server downloads files from here and posts save callbacks here. `http://localhost:3000` works only when both run on the same host without containers; otherwise use the LAN address of your machine, e.g. `http://192.168.1.10:3000`. |
   | `DOCS_LANG` | Editor UI language and the locale of blank templates (`en-US`, `ru-RU`, `de-DE`, …). |
   | `DEMO_USER_ID`, `DEMO_USER_NAME` | The demo user the editor is opened as. |
   | `STORAGE_DIR` | Folder for uploaded documents, `storage` by default. |
   | `ALLOWED_DEV_ORIGINS` | Extra host names that may open the **development** server (`npm run dev`), comma-separated. The host of `APP_URL` is always allowed. In development Next.js refuses to serve its scripts to other origins, so a page opened by an unlisted LAN address renders without working buttons. |

2. Start the app:

   ```bash
   npm start          # production build + server on http://localhost:3000
   npm run dev        # or: development server with hot reload
   ```

   To use another port run `PORT=3001 npm start` (Windows: `set PORT=3001 && npm start`) and
   update `APP_URL` accordingly.

3. Open <http://localhost:3000>, create or upload a document and click it.

## Blank documents are a git submodule

The files behind "New document" come from
[ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates), attached to this
project as a git submodule at `document-templates/` (48 locales, `new/<locale>/new.{docx,xlsx,pptx,pdf}`).
`DOCS_LANG` picks the folder; the resolution order is the exact locale, then the same language
prefix, then `default`, then `en-US`.

If `document-templates/` is empty — the project was cloned without `--recurse-submodules`, or
scaffolded on a machine without git — "New document" reports that the templates are missing. Fetch
them with:

```bash
git submodule update --init
```

Nothing else in the application depends on the submodule: uploading, opening, editing and saving
work without it. To pull newer blank documents later:

```bash
git submodule update --remote document-templates
git add document-templates
```

## How the integration works

```
Browser ──(1) GET /editor/<file> ─────────────▶ this app
Browser ──(2) GET /api/editor-config?file= ───▶ this app  (builds + signs the editor config)
Browser ──(3) loads api.js, opens the editor ─▶ Document Server
Document Server ──(4) GET document.url ───────▶ this app  /api/files/<file>/download
Document Server ──(5) POST callbackUrl ───────▶ this app  /api/callback?file=<file>
this app ──(6) downloads the saved file ──────▶ Document Server (url from the callback)
```

| Piece | Where |
| --- | --- |
| Supported formats (`GET <server>/meta/formats`), edit vs. view decision | `src/lib/formats.ts` |
| Editor config (`documentType`, `document`, `editorConfig`, `token`) | `src/lib/editor-config.ts` |
| JWT signing and verification | `src/lib/jwt.ts` |
| `document.key` generation | `src/lib/document-key.ts` |
| Save callback handler | `src/app/api/callback/route.ts` |
| File download for the Document Server and the user | `src/app/api/files/[name]/download/route.ts` |
| Upload, create from template, delete | `src/app/api/files/**` |
| Editor page (React component `@onlyoffice/document-editor-react`) | `src/components/Editor.tsx` |
| Blank templates from [ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates) | `document-templates/new/<locale>/` |

### Edit or view?

The list of formats comes from the Document Server itself. A file is opened for editing when its
format has the `edit` action, or the `lossy-edit` action (e.g. `odt`, `rtf`, `txt`, `csv`; the UI
warns that formatting may be lost). Formats with only the `view` action (e.g. `doc`, `djvu`, `epub`)
open in the viewer. Files of unknown formats cannot be uploaded.

### Document key

The Document Server identifies an editing session by `document.key`. The key must be the same for
everyone who opens the same file (so they co-edit) and must change once the file is saved. This demo
derives it from the file name, size and modification time, so no database is needed.

## Limitations of this demo

- There is no authentication: a single demo user, and the download route is open (the Document
  Server's JWT is verified only when present). A real application must authorize file access,
  e.g. with one-time signed links.
- Files are stored on the local disk and edited in place; there is no version history.
- Force save (`Ctrl+S` while editing) is disabled; the document is saved when the last user closes it.

## Learn more

- [ONLYOFFICE API documentation](https://api.onlyoffice.com/docs/docs-api/)
- [Editor config reference](https://api.onlyoffice.com/docs/docs-api/usage-api/config/)
- [Callback handler](https://api.onlyoffice.com/docs/docs-api/usage-api/callback-handler/)
- [JWT / security](https://api.onlyoffice.com/docs/docs-api/additional-api/signature/)
- [React component](https://github.com/ONLYOFFICE/document-editor-react)
