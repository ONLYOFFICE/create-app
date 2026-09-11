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
