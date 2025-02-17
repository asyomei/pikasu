import { cp, lstat, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import * as esbuild from 'esbuild'
import { postcssModules, sassPlugin } from 'esbuild-sass-plugin'
import fastGlob from 'fast-glob'
import { TS_RE } from './consts'
import { generateDynamic, generateRoutes, readTemplate } from './generate-entries'
import { transform } from './transform'
import type { PikasuBuildOptions } from './types'

const isDir = async (path: string) => (await lstat(path).catch(() => null))?.isDirectory()

export async function pikasuBuild(options: PikasuBuildOptions): Promise<void> {
  const { publicDir = './public', srcDir, outDir } = options
  if (!srcDir) throw new Error('srcDir is not provided')
  if (!outDir) throw new Error('outDir is not provided')

  if (!(await isDir(publicDir))) {
    await mkdir(publicDir)
  }

  if (!(await isDir(join(srcDir, 'pages')))) {
    throw new Error('pages/ dir not found')
  }

  const { pages, staticComponents, dynamicComponents } = await transform(srcDir)
  const hasDynamic = dynamicComponents.length > 0

  try {
    await build()
  } finally {
    await rm('.pikasu/', { recursive: true, force: true })
  }

  async function build() {
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
      await readTemplate('entry-server.js', { routes: generateRoutes(srcDir, pages) }),
    )

    if (hasDynamic) {
      await writeFile(
        '.pikasu/client/pikasu.js',
        await readTemplate('entry-client.js', { dynamic: generateDynamic(dynamicComponents) }),
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

    const shared: esbuild.BuildOptions = {
      bundle: true,
      format: 'esm',
      loader: { '.jsx': 'js', '.ts': 'js', '.tsx': 'js' },
      plugins: [sass],
    }

    await esbuild.build({
      entryPoints: ['.pikasu/server/pikasu.js'],
      outfile: resolve(outDir, 'server.mjs'),
      platform: 'node',
      minifyIdentifiers: true,
      minifySyntax: true,
      alias: {
        '%CWD%': '.pikasu/server',
        ...resolveExternals([
          'mime-types',
          'hono/router/reg-exp-router',
          'hono/router/smart-router',
          'hono/router/trie-router',
        ]),
      },
      banner: {
        js: [
          'import { createRequire } from "node:module";',
          'var require = createRequire(import.meta.url);',
        ].join('\n'),
      },
      ...shared,
    })

    if (hasDynamic) {
      await esbuild.build({
        entryPoints: ['.pikasu/client/pikasu.js'],
        outdir: resolve(outDir, 'client'),
        platform: 'browser',
        minify: true,
        splitting: true,
        alias: { '%CWD%': '.pikasu/client' },
        ...shared,
      })

      // client doesn't load css files, so remove
      const cssFiles = await fastGlob(join(outDir, 'client/**/*.css'))
      await Promise.all(cssFiles.map(f => rm(f)))
    }

    for (const relpath of await fastGlob('**', { cwd: publicDir })) {
      const filepath = join(publicDir, relpath)
      const outpath = join(outDir, 'public', relpath)
      await mkdir(dirname(outpath), { recursive: true })
      await cp(filepath, outpath)
    }
  }
}

function resolveExternals(modules: string[]) {
  const result: Record<string, string> = {}

  for (const module of modules) {
    result[module] = import.meta.resolve(module).replace('file://', '')
  }

  return result
}
