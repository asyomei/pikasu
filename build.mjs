// @ts-check

import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { transpileDeclaration } from 'typescript'

await rm('libdist', { recursive: true, force: true })
await build({
  entryPoints: ['./lib/build.ts', './lib/babel/custom-directives.ts'],
  outdir: 'libdist',
  platform: 'node',
  format: 'esm',
  minify: false,
  bundle: true,
  packages: 'external',
  sourcemap: 'external',
})

await cp('lib/templates', 'libdist/templates', { recursive: true })
await cp('lib/client.d.ts', 'libdist/client.d.ts')

const { outputText } = transpileDeclaration(await readFile('./lib/build.ts', 'utf8'), {})
await writeFile('libdist/build.d.ts', outputText)
