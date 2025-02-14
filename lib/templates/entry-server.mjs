// @ts-check
// @ts-ignore
const routes = { '/': () => import('./pages/index.js') }
// REPLACE

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import Fastify from 'fastify'
import { generateHydrationScript, renderToStringAsync } from 'solid-js/web'

const PIKASU_SCRIPT = '<script type="module" src="/_h/pikasu.js"></script>'

const fastify = Fastify()
const cache = {}

async function enhance(html) {
  cache.css ??= (await readFile('dist/server.css', 'utf8')).trimEnd()
  const dynamic = html.includes('<div data-pikasu=') && generateHydrationScript() + PIKASU_SCRIPT
  return html.replace('</head>', `${dynamic || ''}<style>${cache.css}</style></head>`)
}

for (const route in routes) {
  fastify.get(route, async (_req, reply) => {
    reply.type('text/html')
    const mod = await routes[route]()
    const props = (await mod.getServerSideProps?.()) ?? {}
    const html = await renderToStringAsync(() => mod.default(props))
    return `<!DOCTYPE html>${await enhance(html)}`
  })
}

fastify.get('/_h/*', async (req, reply) => {
  reply.type('text/javascript')
  // @ts-ignore
  const { '*': path } = req.params
  cache[path] ??= await readFile(join('dist/client', path))
  return cache[path]
})

const port = Number(process.env.PORT || 3000)
try {
  await fastify.listen({ port })
  console.log(`listening on http://localhost:${port}`)
} catch (e) {
  console.error(e)
}
