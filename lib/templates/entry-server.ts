import { readFile } from 'node:fs/promises'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import { RegExpRouter } from 'hono/router/reg-exp-router'
import { SmartRouter } from 'hono/router/smart-router'
import { TrieRouter } from 'hono/router/trie-router'
import { lookup } from 'mime-types'
import { generateHydrationScript, renderToStringAsync } from 'solid-js/web'

declare const routes: Record<string, () => Promise<any>>

const PIKASU_CSS = '[data-pikasu]{display:contents}'
const PIKASU_JS = '<script type="module" src="/_h/pikasu.js"></script>'

const cache: Record<string, any> = {}

const router = new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] })
for (const route in routes) {
  router.add('get', route, routes[route])
}

const host = process.env.HOST || 'localhost'
const port = process.env.PORT || 3000
createServer(handle).listen({ host, port })
console.log(`listening at http://${host}:${port}`)

async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = takeTo(req.url!, '?')

  if (path in cache) {
    setType(res, path)
    res.end(cache[path])
    return
  }

  if (path.startsWith('/_h/')) {
    if (await read(res, `dist/client${path.slice(3)}`)) return

    res.statusCode = 500
    res.end()
    return
  }

  if (await read(res, `dist/public${path}`, false)) return

  res.setHeader('content-type', 'text/html')

  const result = router.match('get', path)
  if (result[0].length === 0) {
    res.statusCode = 404
    res.end('<h1>404 Not Found</h1>')
    return
  }

  const [route, indices] = result[0][0]
  const params: Record<string, any> = {}
  for (const param in indices) {
    params[param] = result[1]?.[indices[param] as any]
  }

  const mod = await (route as any)()
  const comp = await mod.default({ params })
  const html = await renderToStringAsync(() => comp)

  res.end(await enhance(html))
}

async function enhance(html: string) {
  const hasDynamic = html.includes('<div data-pikasu=')

  cache.css ??= await readFile('dist/server.css').catch(() => '')
  const css = (hasDynamic ? PIKASU_CSS : '') + cache.css
  const style = css ? `<style>${css}</style>` : ''

  if (!hasDynamic) {
    return html.replace('</head>', `${style}</head>`)
  }

  const dynamic = generateHydrationScript() + PIKASU_JS
  return html.replace('</head>', `${dynamic}${style}</head>`)
}

async function read(res: ServerResponse, path: string, cachable = true) {
  const buf = await readFile(path).catch(() => null)
  if (!buf) return false

  if (cachable) cache[path] = buf
  setType(res, path)
  res.end(buf)
  return true
}

function setType(res: ServerResponse, path: string) {
  const type = lookup(path)
  if (type) res.setHeader('content-type', type)
}

function takeTo(s: string, m: string) {
  const i = s.indexOf(m)
  return i < 0 ? s : s.slice(0, i)
}
