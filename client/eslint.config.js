const tsParser = require('@typescript-eslint/parser');

module.exports = [
  { ignores: ['node_modules/**', '.expo/**'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname, ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unreachable': 'error',
      'no-unused-labels': 'error',
      'no-constant-condition': 'error',
    },
  },
];
