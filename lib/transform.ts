import { join } from 'node:path'
import { transformAsync, transformFileAsync, transformFromAstAsync } from '@babel/core'
import fastGlob from 'fast-glob'
import { TS_RE } from './consts'

const BABEL_PRESET_TS = import.meta.resolve('@babel/preset-typescript')
const BABEL_PRESET_SOLID = import.meta.resolve('babel-preset-solid')
const BABEL_PLUGIN_JSX = import.meta.resolve('@babel/plugin-syntax-jsx')
const BABEL_PLUGIN_IMPORTS = import.meta.resolve('./babel/resolve-imports.js')
const BABEL_PLUGIN_DIRECTIVES = import.meta.resolve('./babel/custom-directives.js')

export async function transform(cwd: string) {
  const { pages, dynamicSources, staticSources } = await transformPages(cwd)
  const dynamicComponents = await transformDynamicComponents(cwd, dynamicSources)
  const staticComponents = await transformStaticComponents(cwd, staticSources)

  return { pages, staticComponents, dynamicComponents }
}

async function transformPages(cwd: string) {
  const pages: { relpath: string; code: string }[] = []
  const dynamicSources = new Set<string>()
  const staticSources = new Set<string>()

  for (const relpath of await fastGlob('pages/**', { cwd })) {
    if (!TS_RE.test(relpath)) continue

    const filepath = join(cwd, relpath)
    const sourceCode = await parseTSFile(cwd, filepath)

    if (!relpath.endsWith('x')) {
      // simple ts file
      continue
    }

    const ssr = await parseSSRCode(sourceCode)

    for (const path of ssr.dynamicSources) dynamicSources.add(removeCwd(path))
    for (const path of ssr.staticSources) staticSources.add(removeCwd(path))
    pages.push({ relpath, code: ssr.code })
  }

  return { pages, dynamicSources, staticSources }
}

async function transformDynamicComponents(cwd: string, sources: Set<string>) {
  const promises = sources.values().map(async relpath => {
    const filepath = join(cwd, relpath)
    const code = await parseTSFile(cwd, filepath)
    const [ssr, dom] = await Promise.all([parseSSRCode(code), parseDOMCode(code)])
    return { relpath, code: ssr.code, clientCode: dom }
  })

  return await Promise.all(promises)
}

async function transformStaticComponents(
  cwd: string,
  sources: Iterable<string>,
): Promise<{ relpath: string; code: string }[]> {
  const components: { relpath: string; code: string }[] = []

  for (const relpath of sources) {
    const filepath = join(cwd, relpath)
    const code = await parseTSFile(cwd, filepath)
    const ssr = await parseSSRCode(code)

    const sourceComponent = { relpath, code: ssr.code }
    const deepComponents =
      ssr.staticSources.length > 0
        ? await transformStaticComponents(cwd, ssr.staticSources.map(removeCwd))
        : []

    for (const component of [sourceComponent].concat(deepComponents)) {
      if (components.find(x => x.relpath === component.relpath)) continue
      components.push(component)
    }
  }

  return components
}

async function parseTSFile(cwd: string, filepath: string) {
  const result = await transformFileAsync(filepath, {
    babelrc: false,
    presets: [BABEL_PRESET_TS],
    plugins: [[BABEL_PLUGIN_IMPORTS, { cwd, filepath }]],
  })
  return result!.code!
}

async function parseSSRCode(code: string) {
  const inter = await transformAsync(code, {
    babelrc: false,
    plugins: [BABEL_PLUGIN_JSX, BABEL_PLUGIN_DIRECTIVES],
    ast: true,
    code: false,
  })
  const metadata = inter!.metadata as any
  const result = await transformFromAstAsync(inter!.ast!, undefined, {
    babelrc: false,
    presets: [[BABEL_PRESET_SOLID, { generate: 'ssr' }]],
    cloneInputAst: false,
  })
  return {
    code: result!.code!,
    dynamicSources: metadata.dynamicSources as string[],
    staticSources: metadata.staticSources as string[],
  }
}

async function parseDOMCode(code: string) {
  const result = await transformAsync(code, {
    babelrc: false,
    presets: [[BABEL_PRESET_SOLID, { generate: 'dom' }]],
  })
  return result!.code!
}

const removeCwd = (path: string) => path.replace('%CWD%/', '')
