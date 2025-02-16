import type { PluginObj } from '@babel/core'
import { resolveImport } from '#/resolve-import'

export default function babelResolveImports(): PluginObj {
  return {
    pre() {
      this.set('promises', [])
    },
    visitor: {
      ImportDeclaration(path) {
        const { cwd, filepath } = this.opts as any
        const source = path.node.source
        this.get('promises').push(
          resolveImport(cwd, filepath, source.value).then(resolvedImport => {
            source.value = resolvedImport
          }),
        )
      },
    },
    post() {
      return Promise.all(this.get('promises'))
    },
  }
}
