import { readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { types as t, transformFromAstAsync } from '@babel/core'
import type { File } from './transform'

async function generateEntryServer(pages: File[]) {
  const code = await parseTemplate('entry-server.mjs', 'routes', toRoutes(pages))
  if (!code) throw new Error('no code for "entry-server.js"')
  return code
}

async function generateEntryClient(dynamic: string[]) {
  const code = await parseTemplate('entry-client.mjs', 'dynamic', normalizeDynamic(dynamic))
  if (!code) throw new Error('no code for "entry-client.js"')
  return code
}

export async function generateEntries(files: File[], dynamic: string[]): Promise<File[]> {
  const pages = files.filter(file => {
    if (!file.path.startsWith('pages')) return false
    return file.path.split('/').every(s => !s.startsWith('_'))
  })

  const [ssr, dom] = await Promise.all([generateEntryServer(pages), generateEntryClient(dynamic)])
  return [
    {
      path: 'pikasu.css',
      output: { type: 'all', code: '[data-pikasu]{display:contents}' },
    },
    { path: 'pikasu.js', output: { type: 'ssr', code: ssr } },
    { path: 'pikasu.js', output: { type: 'dom', code: dom } },
  ]
}

function toRoutes(pages: File[]) {
  const routes: Record<string, string> = {}

  for (const { path } of pages) {
    const route = path.replace('pages', '').replace(/(?:index)?\.[tj]sx?$/i, '')
    const filepath = `./${path.replace(/\.[tj]sx?$/i, '.js')}`
    routes[route] = filepath
  }

  return routes
}

function normalizeDynamic(dynamic: string[]) {
  const dynamicObj: Record<string, string> = {}

  for (const path of dynamic) {
    dynamicObj[path] = `./${normalize(join('pages', path))}`
  }

  return dynamicObj
}

async function parseTemplate(filename: string, varName: string, object: Record<string, string>) {
  const ast = t.program([
    t.importDeclaration([], t.stringLiteral('./pikasu.css')),
    t.variableDeclaration('const', [
      t.variableDeclarator(
        t.identifier(varName),
        t.objectExpression(
          Object.entries(object).map(([key, value]) =>
            t.objectProperty(
              t.stringLiteral(key),
              t.arrowFunctionExpression([], t.importExpression(t.stringLiteral(value))),
            ),
          ),
        ),
      ),
    ]),
  ])

  const result = await transformFromAstAsync(ast, undefined, {
    babelrc: false,
    cloneInputAst: false,
    compact: true,
  })
  if (!result?.code) return

  const template = await readFile(join(import.meta.dirname, 'templates', filename), 'utf8')
  const idx = template.indexOf('// REPLACE\n')

  return result.code + template.slice(idx + '// REPLACE\n'.length)
}
