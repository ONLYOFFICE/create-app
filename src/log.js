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

import { styleText } from 'node:util';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

/** @param {Parameters<typeof styleText>[0]} format @param {string} text */
export function paint(format, text) {
  return useColor ? styleText(format, text) : text;
}

export const log = {
  info: (message) => console.log(message),
  step: (message) => console.log(`${paint('cyan', '›')} ${message}`),
  success: (message) => console.log(`${paint('green', '✔')} ${message}`),
  warn: (message) => console.warn(`${paint('yellow', '⚠')} ${message}`),
  error: (message) => console.error(`${paint('red', '✖')} ${message}`),
  bold: (text) => paint('bold', text),
  cmd: (text) => paint('cyan', text),
  dim: (text) => paint('dim', text),
};
