import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { INDEX_TS_RE, TS_RE } from './consts'

export function generateRoutes(cwd: string, pages: { relpath: string }[]) {
  const routes = Object.entries(toRoutes(cwd, pages)).map(
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
  const code = Object.entries(vars).map(([id, value]) => `var ${id} = ${value};\n`)
  const template = await readFile(join(import.meta.dirname, 'templates', relpath), 'utf8')
  return code.join('') + template
}

function toRoutes(cwd: string, pages: { relpath: string }[]) {
  const routes: Record<string, string> = {}

  for (const { relpath } of pages) {
    let parts = relpath.split('/').slice(1)

    const last = parts.length - 1
    parts[last] = parts[last].replace(TS_RE, '')

    parts = parts.filter(part => part !== 'index' && !part.startsWith('('))
    for (let i = 0; i < parts.length; ++i) {
      if (parts[i] === '[...]') {
        if (i !== parts.length - 1) {
          const extra = join(cwd, relpath)
          throw new Error(`${extra}: invalid route: [...] should be at the end`)
        }

        parts[i] = '*'
        break
      }

      parts[i] = parts[i]
        .replaceAll(':', '::')
        .replace(/\[\[(\w+)\]\]/g, ':$1?')
        .replace(/\[(\w+)\]/g, ':$1')
    }

    const route = `/${parts.join('/')}`

    if (route in routes) {
      const extra = join(cwd, relpath)
      const existed = join(cwd, routes[route])
      throw new Error(`${extra} and ${existed} have same routes`)
    }

    routes[route] = relpath
  }

  for (const route in routes) {
    routes[route] = `./${routes[route].replace(TS_RE, '.js')}`
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
