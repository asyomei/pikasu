import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { INDEX_TS_RE, TS_RE } from './consts'

export function generateRoutes(pages: { relpath: string }[]) {
  const routes = Object.entries(toRoutes(pages)).map(
    ([route, source]) => `"${route}":()=>import("${source}")`,
  )

  return `{${routes.join()}}`
}

export function generateDynamic(components: { relpath: string }[]) {
  const dynamic = Object.entries(toDynamic(components)).map(
    ([id, source]) => `"${id}":()=>import("${source}")`,
  )

  return `{${dynamic.join()}}`
}

export async function readTemplate(relpath: string, vars: Record<string, string>) {
  const code = Object.entries(vars).map(([id, value]) => `const ${id} = ${value};`)
  const template = await readFile(join(import.meta.dirname, 'templates', relpath), 'utf8')
  const idx = template.indexOf('// REPLACE\n')
  return code + template.slice(idx + '// REPLACE\n'.length)
}

function toRoutes(pages: { relpath: string }[]) {
  const routes: Record<string, string> = {}

  for (const { relpath } of pages) {
    const route = relpath.replace('pages', '').replace(INDEX_TS_RE, '')
    routes[route] = `./${relpath.replace(TS_RE, '.js')}`
  }

  return routes
}

function toDynamic(components: { relpath: string }[]) {
  const dynamic: Record<string, string> = {}

  for (const { relpath } of components) {
    const id = relpath.replace(INDEX_TS_RE, '')
    dynamic[id] = `./${relpath.replace(TS_RE, '.js')}`
  }

  return dynamic
}
