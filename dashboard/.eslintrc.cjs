// This branch has eslint@8 installed (not 9), which doesn't read flat
// eslint.config.js by default — legacy .eslintrc format, equivalent rules
// to the flat config used on feature/dashboard.
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ['eslint:recommended', 'plugin:react-hooks/recommended'],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react', 'react-refresh'],
  rules: {
    // Core no-unused-vars only tracks plain Identifier nodes, not the
    // JSXIdentifier nodes JSX produces — without this, every component
    // imported and only ever used as `<Component />` is flagged as unused.
    'react/jsx-uses-vars': 'error',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
