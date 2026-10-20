import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'topics/*/store/', 'topics/*/work/', 'topics/*/sources/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  { files: ['scripts/**/*.mjs', '*.config.{js,mjs}'], languageOptions: { globals: globals.node } },
  prettier,
];
