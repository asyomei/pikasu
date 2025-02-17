// @ts-check

import { cp, rm } from 'node:fs/promises'
import { build } from 'esbuild'

await rm('libdist', { recursive: true, force: true })

/** @type {import('esbuild').BuildOptions} */
const shared = {
  platform: 'node',
  format: 'esm',
  minify: false,
  bundle: true,
  packages: 'external',
}

await build({
  entryPoints: [
    './lib/build.ts',
    './lib/babel/custom-directives.ts',
    './lib/babel/resolve-imports.ts',
  ],
  outdir: 'libdist',
  sourcemap: 'linked',
  ...shared,
})

await build({
  entryPoints: ['./lib/templates/*.ts'],
  outdir: 'libdist/templates',
  ...shared,
})

await cp('lib/client.d.ts', 'libdist/client.d.ts')
await cp('lib/types.d.ts', 'libdist/types.d.ts')
