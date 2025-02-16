// @ts-check

import { cp, rm } from 'node:fs/promises'
import { build } from 'esbuild'

await rm('libdist', { recursive: true, force: true })
await build({
  entryPoints: [
    './lib/build.ts',
    './lib/babel/custom-directives.ts',
    './lib/babel/resolve-imports.ts',
  ],
  outdir: 'libdist',
  platform: 'node',
  format: 'esm',
  minify: false,
  bundle: true,
  packages: 'external',
  sourcemap: 'linked',
})

await cp('lib/templates', 'libdist/templates', { recursive: true })
await cp('lib/client.d.ts', 'libdist/client.d.ts')
await cp('lib/types.d.ts', 'libdist/types.d.ts')
