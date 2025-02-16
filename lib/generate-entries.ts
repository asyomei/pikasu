import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { INDEX_TS_RE, TS_RE } from './consts'

export async function generateEntryServer(pages: { relpath: string }[]) {
  const code = await parseTemplate('server', toRoutes(pages))
  if (!code) throw new Error('no code for "entry-server.js"')
  return code
}

export async function generateEntryClient(components: { relpath: string }[]) {
  const code = await parseTemplate('client', toDynamic(components))
  if (!code) throw new Error('no code for "entry-client.js"')
  return code
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

async function parseTemplate(type: 'server' | 'client', object: Record<string, string>) {
  const template = await readFile(join(import.meta.dirname, `templates/entry-${type}.mjs`), 'utf8')
  const idx = template.indexOf('// REPLACE\n')

  const varName = { server: 'routes', client: 'dynamic' }[type]

  let data = `const ${varName}={`
  for (const [key, value] of Object.entries(object)) {
    data += `${JSON.stringify(key)}:()=>import(${JSON.stringify(value)}),`
  }
  data += '};'

  if (type === 'server') data = `import"./pikasu.css";\n${data}`
  return data + template.slice(idx + '// REPLACE\n'.length)
}
