module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
  },
  ignorePatterns: [
    'client/build/',
    'client/node_modules/',
    'node_modules/',
    'remote/',
    'e2e/',
    'playwright.config.js',
    'playwright-report/',
    'test-results/',
  ],
};
