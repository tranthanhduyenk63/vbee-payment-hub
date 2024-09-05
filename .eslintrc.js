module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ['prettier', 'airbnb-base'],
  plugins: ['prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'prettier/prettier': ['error'],
    camelcase: 'off',
    'no-underscore-dangle': 'off',
    'comma-dangle': 'off',
    'prefer-regex-literals': 'off',
    'no-await-in-loop': 'off',
    'no-param-reassign': 'off',
    'object-curly-newline': 'off',
    'no-restricted-syntax': 'off',
    'operator-linebreak': 'off',
    'no-unused-vars': [2, { args: 'none' }],
  },
};
