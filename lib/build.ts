import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import * as esbuild from 'esbuild'
import glob from 'fast-glob'
import { transform } from './transform'

export interface PikasuBuildOptions {
  srcdir: string
  outdir: string
}

export async function pikasuBuild(options: PikasuBuildOptions): Promise<void> {
  const { srcdir, outdir } = options
  const { files } = await transform(srcdir)

  await rm('.pikasu/gen', { recursive: true, force: true })
  await Promise.all(
    files
      .flatMap(file =>
        file.output.type !== 'all'
          ? [file]
          : [
              { ...file, output: { ...file.output, type: 'ssr' } },
              { ...file, output: { ...file.output, type: 'dom' } },
            ],
      )
      .map(async ({ path, output }) => {
        const outpath = join(
          `.pikasu/gen/${output.type}`,
          srcdir,
          path.replace(/\.[tj]sx?$/i, '.js'),
        )
        await mkdir(dirname(outpath), { recursive: true })

        if (output.code) {
          await writeFile(outpath, output.code)
        } else {
          await cp(join(srcdir, path), outpath)
        }
      }),
  )

  await Promise.all([
    cp('tsconfig.json', '.pikasu/gen/ssr/tsconfig.json'),
    cp('tsconfig.json', '.pikasu/gen/dom/tsconfig.json'),
  ])

  await Promise.all([
    esbuild.build({
      absWorkingDir: resolve('.pikasu/gen/ssr'),
      entryPoints: [join(srcdir, 'pikasu.js')],
      outfile: resolve(outdir, 'server.mjs'),
      bundle: true,
      platform: 'node',
      minify: true,
      format: 'esm',
      banner: {
        // create require for fastify
        js: 'import{createRequire}from"node:module";var require=createRequire(import.meta.url);',
      },
    }),
    esbuild.build({
      absWorkingDir: resolve('.pikasu/gen/dom'),
      entryPoints: [join(srcdir, 'pikasu.js')],
      outdir: resolve(outdir, 'client'),
      bundle: true,
      platform: 'browser',
      minify: true,
      splitting: true,
      format: 'esm',
    }),
  ])

  // client doesn't use css files, so remove
  const cssFiles = await glob('dist/client/**/*.css')
  await Promise.all(cssFiles.map(f => rm(f)))
}
