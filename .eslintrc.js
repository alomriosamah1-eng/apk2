/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'max-lines': ['warn', 300],
    'max-depth': ['warn', 3],
    'max-params': ['warn', 3],
    'complexity': ['warn', 10],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-duplicate-imports': 'error',
  },
  ignorePatterns: ['node_modules/', '.expo/', 'dist/', 'android/', 'server/', '*.config.js'],
  overrides: [
    {
      // Test files deliberately use `require()` for module mocking and manual
      // dependency injection, and commonly exceed UI complexity/length limits.
      files: ['__tests__/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^mock' }],
        'max-lines': 'off',
        'max-depth': 'off',
        'max-params': 'off',
        'complexity': 'off',
      },
    },
  ],
};
