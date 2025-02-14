// @ts-check

import { cp, readFile, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import * as ts from 'typescript'

await build({
  entryPoints: ['./lib/build.ts', './lib/babel/wrap-client-directives.ts'],
  outdir: 'libdist',
  platform: 'node',
  format: 'esm',
  minify: false,
  bundle: true,
  packages: 'external',
  sourcemap: 'external',
})

await cp('lib/templates', 'libdist/templates', { recursive: true })

const { outputText } = ts.transpileDeclaration(await readFile('./lib/build.ts', 'utf8'), {})
await writeFile('libdist/build.d.ts', outputText)
