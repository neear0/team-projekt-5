import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', 'web/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true },
    },
  },
  {
    // Náš kód píšeme v snake_case. Typy a Zod schémy v PascalCase, konštanty v UPPER_CASE.
    // Vlastnosti v objektoch sa nekontrolujú, lebo knižnice (Playwright, Lighthouse) majú camelCase.
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['snake_case'], leadingUnderscore: 'allow' },
        { selector: 'variable', format: ['snake_case', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'import', format: null },
        // Vercel volá exporty podľa HTTP metódy.
        { selector: 'function', filter: { regex: '^(GET|POST)$', match: true }, format: null },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        { selector: ['objectLiteralProperty', 'objectLiteralMethod'], format: null },
        { selector: 'typeProperty', format: ['snake_case'], filter: { regex: '-', match: false } },
      ],
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
