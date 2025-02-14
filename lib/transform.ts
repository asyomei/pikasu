import { readdir } from 'node:fs/promises'
import { join, normalize, relative, resolve } from 'node:path'
import { transformFileAsync, transformFromAstAsync } from '@babel/core'
import { generateEntries } from './generate-entries'

export interface Output {
  type: 'ssr' | 'dom' | 'all'
  code?: string
}

export interface File {
  path: string
  output: Output
}

export interface Result {
  files: File[]
  dynamic: string[]
}

export async function transform(cwd: string): Promise<Result> {
  const dynamic: string[] = []
  const files: File[] = []

  for (const file of await readdir(cwd, { withFileTypes: true, recursive: true })) {
    if (file.isDirectory()) continue

    const path = join(relative(cwd, file.parentPath), file.name)
    const addOut = (output: Output) => files.push({ path, output })

    if (!/\.[jt]sx?/i.test(file.name)) {
      addOut({ type: 'all' })
      continue
    }

    const filepath = join(file.parentPath, file.name)

    if (!file.name.endsWith('x')) {
      const output = await transformTSFile(filepath)
      if (output) addOut({ type: 'all', code: output.code })
      continue
    }

    const ssr = await transformSSRFile(filepath)
    if (!ssr) continue

    for (const source of ssr.dynamic) {
      if (dynamic.includes(source)) continue
      dynamic.push(source)

      const filename = `${source}.tsx`
      const filepath = resolve(file.parentPath, filename)
      const output = await transformDOMFile(filepath)
      if (!output) continue

      const path = normalize(join(relative(cwd, file.parentPath), filename))
      files.push({ path, output })
    }

    addOut(ssr.output)
  }

  return { dynamic, files: files.concat(await generateEntries(files, dynamic)) }
}

async function transformTSFile(filepath: string): Promise<Output | undefined> {
  const result = await transformFileAsync(filepath, {
    babelrc: false,
    presets: ['@babel/preset-typescript'],
    compact: true,
  })
  return result?.code?.at && { type: 'all', code: result.code }
}

async function transformDOMFile(filepath: string): Promise<Output | undefined> {
  const result = await transformFileAsync(filepath, {
    babelrc: false,
    presets: ['@babel/preset-typescript', ['solid', { generate: 'dom' }]],
    compact: true,
  })
  return result?.code?.at && { type: 'dom', code: result.code }
}

async function transformSSRFile(
  filepath: string,
): Promise<{ output: Output; dynamic: string[] } | undefined> {
  const inter = await transformFileAsync(filepath, {
    babelrc: false,
    presets: ['@babel/preset-typescript'],
    plugins: [join(import.meta.dirname, 'babel/wrap-client-directives.js')],
    ast: true,
    code: false,
  })
  if (!inter?.ast) return

  // solid preset breaks the plugin
  const result = await transformFromAstAsync(inter.ast, undefined, {
    babelrc: false,
    presets: [['solid', { generate: 'ssr' }]],
    compact: true,
    cloneInputAst: false,
  })
  return (
    result?.code?.at && {
      output: { type: 'ssr', code: result.code },
      dynamic: (inter.metadata as any)?.dynamic ?? [],
    }
  )
}
