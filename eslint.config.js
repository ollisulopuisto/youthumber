import js from '@eslint/js'
import globals from 'globals'
import react from '@eslint-react/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', '.venv', 'release', 'build', '.claude'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { 'react-x': { version: '19.3.1' } },
    plugins: {
      "@eslint-react": react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // One Hooks implementation, avoiding duplicate reports from the unified plugin.
      ...Object.fromEntries(Object.keys(react.configs['disable-conflict-eslint-plugin-react-hooks'].rules).map((id) => [id.replace('react-hooks/', '@eslint-react/'), 'off'])),
      '@eslint-react/no-missing-component-display-name': 'error',
      '@eslint-react/dom-no-unknown-property': 'error',
      '@eslint-react/jsx-no-comment-textnodes': 'error',
      '@eslint-react/jsx-no-children-prop': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
