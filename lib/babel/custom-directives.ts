import type { PluginObj } from '@babel/core'
import { transformCustomDirective } from '../transform-custom-directive'
import type { BabelTypes } from './types'

export default function babelCustomDirectives({ types: t }: { types: BabelTypes }): PluginObj {
  return {
    pre() {
      this.set('imports', [])
      this.set('dynamic', [])
    },
    visitor: {
      ImportDeclaration(path) {
        const items = path.node.specifiers.map(x => x.local.name).filter(x => /^[A-Z]/.test(x))

        if (items.length > 0) {
          this.get('imports').push({ items, source: path.node.source.value })
        }
      },
      JSXIdentifier(path) {
        if (!path.node.name.startsWith('pikasu-')) return

        const result = transformCustomDirective(t, path, this.get('imports'))
        if (result) {
          this.get('dynamic').push(result.dynamicSource)
        }
      },
    },
    post() {
      const dynamic = this.get('dynamic')
      if (dynamic.length > 0) {
        ;(this.file.metadata as any).dynamic = dynamic
      }
    },
  }
}
