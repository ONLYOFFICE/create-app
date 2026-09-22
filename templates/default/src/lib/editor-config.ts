/**
 * Builds the configuration object for the ONLYOFFICE editor
 * (https://api.onlyoffice.com/docs/docs-api/usage-api/config/) and signs it with JWT.
 *
 * This runs on the server only: the JWT secret must never reach the browser.
 */
import type { Config, FileType, Lang, Region } from '@onlyoffice/doceditor-types';
import { requireEnv } from './env';
import { documentKey } from './document-key';
import { decideOpen, findFormat } from './formats';
import { BadRequest } from './http';
import { signPayload } from './jwt';
import { isLoopbackHost, publicBaseUrl } from './public-url';
import { extOf, safeName, statFile } from './storage';
import type { OpenDecision } from './types';

export type EditorSession = {
  /** Editor config, signed when JWT is enabled. */
  config: Config;
  /** Document Server URL for the browser (where api.js is loaded from). */
  documentServerUrl: string;
  decision: NonNullable<OpenDecision>;
  /** Non-fatal hints for the developer, shown above the editor. */
  warnings: string[];
};

/** Language codes accepted by `editorConfig.lang` that consist of more than one part. */
const MULTI_PART_LANGS = ['pt-PT', 'sr-Cyrl', 'zh-TW'];

/**
 * Maps `DOCS_LANG` (e.g. `en-US`, `de-DE`, `pt-BR`, `zh-TW`) to the editor UI language
 * and the regional settings.
 */
export function editorLocale(docsLang: string): { lang: Lang; region?: Region } {
  const normalized = docsLang.replace('_', '-');
  const multi = MULTI_PART_LANGS.find((code) => normalized.toLowerCase().startsWith(code.toLowerCase()));
  const lang = (multi ?? normalized.split('-')[0].toLowerCase()) as Lang;
  const region = /^[a-z]{2,3}-[A-Za-z]{2,4}(-[A-Za-z]{2})?$/.test(normalized)
    ? (normalized as Region)
    : undefined;
  return { lang, region };
}

export async function buildEditorSession(request: Request, fileName: string): Promise<EditorSession> {
  const env = requireEnv();
  const name = safeName(fileName);
  const info = await statFile(name);

  const format = await findFormat(name);
  const decision = decideOpen(format);
  if (!format || !decision) {
    throw new BadRequest(`Files of type ".${extOf(name)}" cannot be opened by the Document Server`);
  }

  const baseUrl = publicBaseUrl(request, env);
  const encodedName = encodeURIComponent(name);
  const { lang, region } = editorLocale(env.lang);
  const canEdit = decision.mode === 'edit';

  const config: Config = {
    type: 'desktop',
    documentType: format.type,
    document: {
      fileType: extOf(name) as FileType,
      key: documentKey(name, info.mtimeMs, info.size),
      title: name,
      // The Document Server downloads the file from here.
      url: `${baseUrl}/api/files/${encodedName}/download`,
      permissions: {
        edit: canEdit,
        review: canEdit && format.actions.includes('review'),
        comment: canEdit && format.actions.includes('comment'),
        fillForms: canEdit && format.actions.includes('fill'),
        modifyFilter: canEdit && format.actions.includes('customfilter'),
        download: true,
        print: true,
        copy: true,
      },
    },
    editorConfig: {
      // The Document Server posts editing events and the saved document here.
      callbackUrl: `${baseUrl}/api/callback?file=${encodedName}`,
      mode: decision.mode,
      lang,
      region,
      user: { id: env.user.id, name: env.user.name },
      customization: {
        autosave: true,
        forcesave: false,
        compactHeader: false,
        feedback: false,
        // The editor lives in its own tab: "back" navigates that tab to the file list.
        goback: { url: `${baseUrl}/`, text: 'Back to files', blank: false },
      },
    },
  };

  if (env.jwtSecret) {
    config.token = await signPayload(config, env.jwtSecret);
  }

  const warnings: string[] = [];
  if (!env.appUrl && isLoopbackHost(baseUrl)) {
    warnings.push(
      `APP_URL is not set, so the Document Server will try to download the file from ${baseUrl}. ` +
        'Unless the Document Server runs on this very host, set APP_URL in .env to an address ' +
        'the Document Server can reach.',
    );
  }
  if (!env.jwtSecret) {
    warnings.push(
      'DOCUMENT_SERVER_JWT_SECRET is empty: the editor config is not signed. ' +
        'This only works if JWT is disabled on the Document Server.',
    );
  }

  return { config, documentServerUrl: env.documentServerUrl, decision, warnings };
}
