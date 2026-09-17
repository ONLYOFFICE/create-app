# Changelog

## 0.1.0 — unreleased

- Initial release: `npx @onlyoffice/create-app my-app` scaffolds a Next.js demo
  with a file manager, ONLYOFFICE editor integration (JWT, callback, `meta/formats`) and blank
  document templates for 48 locales.
- The generated project is a git repository, and the blank documents are attached to it as the
  `document-templates` submodule of
  [ONLYOFFICE/document-templates](https://github.com/ONLYOFFICE/document-templates) instead of being
  copied into the npm package. Use `--skip-git` to opt out.
