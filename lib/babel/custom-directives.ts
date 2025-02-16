import type { PluginObj } from '@babel/core'
import { type ImportElement, transformCustomDirective } from '../transform-custom-directive'
import type { Babel } from './types'

export default function babelCustomDirectives({ types: t }: Babel): PluginObj {
  return {
    pre() {
      this.set('imports', [])
      this.set('dynamic', [])
    },
    visitor: {
      ImportDeclaration(path) {
        const source = path.node.source.value
        if (!source.startsWith('%CWD%')) return

        const items = path.node.specifiers.map(x => x.local.name).filter(x => /^[A-Z]/.test(x))
        if (items.length > 0) {
          this.get('imports').push({ items, source })
        }
      },
      JSXIdentifier(path) {
        if (!path.node.name.startsWith('pikasu-')) return

        const dynamicSources = this.get('dynamic')
        const result = transformCustomDirective(t, path, this.get('imports'))
        if (result && !dynamicSources.includes(result.dynamicSource)) {
          dynamicSources.push(result.dynamicSource)
        }
      },
    },
    post(file) {
      const imports = this.get('imports') as ImportElement[]
      const dynamicSources = this.get('dynamic') as string[]
      const staticSources = imports
        .filter(x => !dynamicSources.includes(x.source))
        .map(x => x.source)

      Object.assign(file.metadata, { dynamicSources, staticSources })
    },
  }
}
