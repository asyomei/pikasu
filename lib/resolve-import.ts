import { lstat, readFile } from 'node:fs/promises'
import { basename, dirname, join, normalize, relative } from 'node:path'

interface TSOptions {
  baseUrl?: string
  paths: Record<string, string[]>
}

const config = JSON.parse(await readFile('tsconfig.json', 'utf8'))
const opts = config.compilerOptions as TSOptions | undefined

export async function resolveImport(
  cwd: string,
  filepath: string,
  source: string,
): Promise<string> {
  const fromCwd = (path: string) => `%CWD%/${relative(cwd, path)}`

  const baseUrl = opts?.baseUrl ?? '.'

  for (const alias in opts?.paths) {
    if (!alias.endsWith('*')) {
      if (source !== alias) continue

      for (const path of opts.paths[alias]) {
        const sourceFile = await resolveSourceFile(join(baseUrl, path))
        if (sourceFile) return fromCwd(sourceFile)
      }

      throw new Error(`could not resolve ${source}`)
    }

    const aliasBase = alias.slice(0, -1)
    if (!source.startsWith(aliasBase)) continue

    for (const path of opts.paths[alias]) {
      const pathBase = join(baseUrl, path.slice(0, -1))
      const sourcePath = source.replace(aliasBase, pathBase)
      const sourceFile = await resolveSourceFile(sourcePath)
      if (sourceFile) return fromCwd(sourceFile)
    }

    throw new Error(`could not resolve ${source}`)
  }

  if (source.startsWith('.')) {
    const sourcePath = normalize(join(dirname(filepath), source))
    const sourceFile = await resolveSourceFile(sourcePath)
    if (!sourceFile) throw new Error(`could not resolve ${sourcePath}`)

    return fromCwd(sourceFile)
  }

  return source
}

async function resolveSourceFile(path: string) {
  const stats = await lstat(path).catch(() => null)
  if (stats?.isFile() && basename(path).includes('.')) return path
  if (stats?.isDirectory()) path += '/index'

  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    const stats = await lstat(path + ext).catch(() => null)
    if (stats) return `${path}${ext}`
  }

  if (stats?.isFile()) return path
}
