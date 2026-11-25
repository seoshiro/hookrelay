import { build } from 'esbuild';
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  outfile: 'dist/index.js',
  packages: 'external',
  // the workspace package ships TS sources, so it must be bundled in
  external: [],
  plugins: [{ name: 'bundle-shared', setup(b) { b.onResolve({ filter: /^@hookrelay\/shared$/ }, () => ({ path: new URL('../../../packages/shared/src/index.ts', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') })); } }],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
console.log('built dist/index.js');
