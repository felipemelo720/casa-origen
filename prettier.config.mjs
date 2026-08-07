/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  // 100, no 80: todo el repo ya está escrito a ~100 y con 80 `format:check`
  // fallaba en 92 archivos, o sea nunca se corrió. Se ajusta la regla al
  // código en vez de reescribir el código para la regla.
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindFunctions: ['cn', 'cva', 'clsx'],
};

export default config;
