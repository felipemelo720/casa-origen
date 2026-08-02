/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindFunctions: ['cn', 'cva', 'clsx'],
};

export default config;
