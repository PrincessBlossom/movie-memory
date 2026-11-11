// Lets TypeScript resolve plain CSS imports like `import "./globals.css"`.
// The project's TypeScript (5.9) doesn't need this, but editors bundling
// TypeScript 6+ check side-effect imports by default
// (noUncheckedSideEffectImports), and Next.js only ships declarations for
// CSS Modules (*.module.css). This keeps the editor and `tsc` in agreement.
declare module "*.css";
