import eslint from '@eslint/js';

export default [
  eslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];
