module.export = {
  parser: '@babel/eslint-parser',
  extends: [
    'plugin:prettier/recommended',
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:promise/recommended',
    'plugin:react-hooks/recommended',
  ],
  env: {
    node: true,
    es6: true,
    'jest/globals': true,
  },
  plugins: ['prettier', 'jest', 'promise'],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': [
      'error',
      {
        arrowParens: 'avoid',
        singleQuote: true,
        jsxBracketSameLine: true,
        trailingComma: 'es5',
        printWidth: 120,
        semi: true,
        endOfLine: 'lf',
      },
    ],
    'no-unused-vars': [
      2,
      {
        vars: 'all',
        args: 'after-used',
      },
    ],
    'max-len': [
      'error',
      {
        code: 120,
        ignoreUrls: true,
        ignoreComments: true,
      },
    ],
    'no-unexpected-multiline': 'error',
  },
};
