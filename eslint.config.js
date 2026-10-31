import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'topics/*/store/', 'topics/*/work/', 'topics/*/sources/', 'docs/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'src/modules/evidence/*.mjs', '.claude/**/*.mjs', '*.config.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  // Web-quality gate (F. security): HTML-string sinks only with committed repo content, each use disabled with a reason.
  {
    files: ['src/**/*.{astro,ts}'],
    ignores: ['src/modules/video/**'],
    rules: {
      'astro/no-set-html-directive': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Build DOM nodes or set textContent; an HTML string is an injection sink.',
        },
        {
          selector:
            "CallExpression[callee.property.name='insertAdjacentHTML'], CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
          message: 'Build DOM nodes or set textContent; an HTML string is an injection sink.',
        },
      ],
    },
  },
  prettier,
];
