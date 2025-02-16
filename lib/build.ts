import { cp, lstat, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import * as esbuild from 'esbuild'
import fastGlob from 'fast-glob'
import { TS_RE } from './consts'
import { generateEntryClient, generateEntryServer } from './generate-entries'
import { transform } from './transform'
import type { PikasuBuildOptions } from './types'

export async function pikasuBuild(options: PikasuBuildOptions): Promise<void> {
  const { publicDir = './public', srcDir, outDir } = options
  if (!srcDir) throw new Error('srcDir is not provided')
  if (!outDir) throw new Error('outDir is not provided')

  if (!(await lstat(publicDir)).isDirectory()) {
    throw new Error(`${publicDir} dir is missing`)
  }

  const { pages, staticComponents, dynamicComponents } = await transform(srcDir)

  await rm('.pikasu/', { recursive: true, force: true })

  for (const { relpath, code } of pages.concat(staticComponents, dynamicComponents)) {
    const outpath = join('.pikasu/server', relpath)
    await mkdir(dirname(outpath), { recursive: true })
    await writeFile(outpath, code)
  }

  for (const { relpath, clientCode } of dynamicComponents) {
    const outpath = join('.pikasu/client', relpath)
    await mkdir(dirname(outpath), { recursive: true })
    await writeFile(outpath, clientCode)
  }

  await writeFile('.pikasu/server/pikasu.css', '[data-pikasu]{display:contents}')
  await writeFile('.pikasu/server/pikasu.js', await generateEntryServer(pages))
  await writeFile('.pikasu/client/pikasu.js', await generateEntryClient(dynamicComponents))

  for (const relpath of await fastGlob('**', { cwd: srcDir })) {
    if (TS_RE.test(relpath)) continue

    await mkdir(join('.pikasu/server', dirname(relpath)), { recursive: true })
    await mkdir(join('.pikasu/client', dirname(relpath)), { recursive: true })
    await cp(join(srcDir, relpath), join('.pikasu/server', relpath))
    await cp(join(srcDir, relpath), join('.pikasu/client', relpath))
  }

  await esbuild.build({
    absWorkingDir: resolve('.pikasu/server'),
    entryPoints: ['pikasu.js'],
    outfile: resolve(outDir, 'server.mjs'),
    bundle: true,
    platform: 'node',
    minify: true,
    format: 'esm',
    alias: {
      '%CWD%': '.pikasu/server',
      fastify: import.meta.resolve('fastify').replace('file://', ''),
      'mime-types': import.meta.resolve('mime-types').replace('file://', ''),
    },
    loader: { '.jsx': 'js', '.ts': 'js', '.tsx': 'js' },
    banner: {
      // create require for fastify
      js: 'import{createRequire}from"node:module";var require=createRequire(import.meta.url);',
    },
  })

  await esbuild.build({
    absWorkingDir: resolve('.pikasu/client'),
    entryPoints: ['pikasu.js'],
    outdir: resolve(outDir, 'client/_h'),
    bundle: true,
    platform: 'browser',
    minify: true,
    splitting: true,
    format: 'esm',
    alias: { '%CWD%': '.pikasu/client' },
    loader: { '.jsx': 'js', '.ts': 'js', '.tsx': 'js' },
  })

  for (const relpath of await fastGlob('**', { cwd: publicDir })) {
    const filepath = join(publicDir, relpath)
    await mkdir(dirname(filepath), { recursive: true })
    await cp(filepath, join(outDir, 'client', relpath))
  }
}
