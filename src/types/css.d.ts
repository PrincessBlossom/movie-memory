// Lets TypeScript resolve plain CSS imports like `import "./globals.css"`.
// TypeScript 6 checks side-effect imports by default (noUncheckedSideEffectImports),
// and Next.js only ships declarations for CSS Modules (*.module.css).
declare module "*.css";
