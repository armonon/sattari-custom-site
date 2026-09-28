import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Node code: functions, the local API server, build/QA scripts and their tests.
const node = ['netlify/**', 'server/**', 'scripts/**', 'tests/**', '*.config.{js,mjs,ts}'];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      '.netlify/**',
      '.local-data/**',
      'public/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    // An explicit version: eslint-plugin-react's 'detect' calls a context API
    // that ESLint 10 removed.
    settings: { react: { version: '18.3' } },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Vitest runs with `globals: true`.
    files: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.vitest } },
  },
  {
    // QA scripts also run code inside the page (Playwright evaluate), and the
    // function tests render the staff page in jsdom.
    files: node,
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.vitest } },
  },
  {
    files: ['**/*.worklet.js'],
    languageOptions: { globals: { ...globals.audioWorklet } },
  },
  prettierRecommended,
  {
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // `const { secret, ...safe } = record` is how records are trimmed.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: node,
    rules: { 'no-console': 'off' },
  }
);
