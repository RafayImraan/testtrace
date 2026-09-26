module.exports = {
  root: true,
  env: { node: true, browser: true, es2022: true, jest: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['frontend/src/**/*.{js,jsx}'],
      env: { browser: true },
      parserOptions: { ecmaFeatures: { jsx: true } },
      plugins: ['react'],
      settings: { react: { version: 'detect' } },
      rules: {
        'react/jsx-uses-vars': 'error',
        'react/jsx-uses-react': 'error',
      },
    },
  ],
};
