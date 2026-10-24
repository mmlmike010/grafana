// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Raw ipcRenderer is the preload's job only; everything else talks to main through the contextBridge API.
const ipcRendererMessage = 'Raw ipcRenderer is only allowed in desktop/src/preload/.';

export default defineConfig(
  {
    ignores: ['dist/', 'node_modules/'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'electron', importNames: ['ipcRenderer'], message: ipcRendererMessage }] },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'MemberExpression[property.name="ipcRenderer"]', message: ipcRendererMessage },
        { selector: 'ObjectPattern > Property[key.name="ipcRenderer"]', message: ipcRendererMessage },
      ],
    },
  },
  {
    files: ['src/preload/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
    },
  }
);
