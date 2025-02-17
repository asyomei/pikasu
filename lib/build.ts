import { cp, lstat, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import * as esbuild from 'esbuild'
import { postcssModules, sassPlugin } from 'esbuild-sass-plugin'
import fastGlob from 'fast-glob'
import { TS_RE } from './consts'
import { generateDynamic, generateRoutes, readTemplate } from './generate-entries'
import { transform } from './transform'
import type { PikasuBuildOptions } from './types'

const stat = (path: string) => lstat(path).catch(() => null)

export async function pikasuBuild(options: PikasuBuildOptions): Promise<void> {
  const { publicDir = './public', srcDir, outDir } = options
  if (!srcDir) throw new Error('srcDir is not provided')
  if (!outDir) throw new Error('outDir is not provided')

  if (!(await stat(publicDir))?.isDirectory()) {
    await mkdir(publicDir)
  }

  if (!(await stat(join(srcDir, 'pages')))?.isDirectory()) {
    throw new Error('pages/ dir not found')
  }

  const { pages, staticComponents, dynamicComponents } = await transform(srcDir)
  const hasDynamic = dynamicComponents.length > 0

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

  await writeFile(
    '.pikasu/server/pikasu.js',
    await readTemplate('entry-server.mjs', { routes: generateRoutes(pages) }),
  )

  if (hasDynamic) {
    await writeFile(
      '.pikasu/client/pikasu.js',
      await readTemplate('entry-client.mjs', { dynamic: generateDynamic(dynamicComponents) }),
    )
  }

  for (const relpath of await fastGlob('**', { cwd: srcDir })) {
    if (TS_RE.test(relpath)) continue

    await mkdir(join('.pikasu/server', dirname(relpath)), { recursive: true })
    await cp(join(srcDir, relpath), join('.pikasu/server', relpath))

    if (hasDynamic) {
      await mkdir(join('.pikasu/client', dirname(relpath)), { recursive: true })
      await cp(join(srcDir, relpath), join('.pikasu/client', relpath))
    }
  }

  const sass = sassPlugin({
    embedded: true,
    transform: postcssModules({}),
  })

  await esbuild.build({
    entryPoints: ['.pikasu/server/pikasu.js'],
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
    define: {
      hasDynamic: String(hasDynamic),
    },
    loader: { '.jsx': 'js', '.ts': 'js', '.tsx': 'js' },
    banner: {
      // create require for fastify
      js: 'import{createRequire}from"node:module";var require=createRequire(import.meta.url);',
    },
    plugins: [sass],
  })

  if (hasDynamic) {
    await esbuild.build({
      entryPoints: ['.pikasu/client/pikasu.js'],
      outdir: resolve(outDir, 'client/_h'),
      bundle: true,
      platform: 'browser',
      minify: true,
      splitting: true,
      format: 'esm',
      alias: { '%CWD%': '.pikasu/client' },
      loader: { '.jsx': 'js', '.ts': 'js', '.tsx': 'js' },
      plugins: [sass],
    })

    // client doesn't load css files, so remove
    const cssFiles = await fastGlob(join(outDir, 'client/_h/**/*.css'))
    await Promise.all(cssFiles.map(f => rm(f)))
  }

  await rm('.pikasu/', { recursive: true })

  for (const relpath of await fastGlob('**', { cwd: publicDir })) {
    const filepath = join(publicDir, relpath)
    await mkdir(dirname(filepath), { recursive: true })
    await cp(filepath, join(outDir, 'client', relpath))
  }
}
