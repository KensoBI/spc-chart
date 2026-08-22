const grafanaConfig = require('@grafana/eslint-config/flat');
const deprecation = require('eslint-plugin-deprecation');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  {
    // Flat config does not honour .gitignore, so build output and tooling
    // artifacts have to be listed explicitly or eslint lints the bundle.
    ignores: [
      '**/node_modules/',
      'dist/',
      'artifacts/',
      'work/',
      'ci/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
      'playwright/.cache/',
      'playwright/.auth/',
      '**/.eslintcache',
    ],
  },
  ...grafanaConfig,
  {
    rules: {
      'react/prop-types': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
      // Registered but not enabled: the webpack build lints through the legacy
      // .config/.eslintrc, which reports deprecations as `deprecation/deprecation`.
      // Making the name resolvable here lets one disable directive cover both
      // configs instead of erroring as an unknown rule.
      deprecation,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },
  {
    files: ['src/config.ts'],
    rules: {
      // graphFieldOptions is deprecated but getGraphFieldOptions is not available in runtime Grafana version
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
];
