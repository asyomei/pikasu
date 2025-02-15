import type { NodePath } from '@babel/core'
import type { BabelTypes } from './babel/types'

interface ImportElement {
  source: string
  items: string[]
}

export function transformCustomDirective(
  t: BabelTypes,
  path: NodePath<babel.types.JSXIdentifier>,
  imports: ImportElement[],
) {
  if (path.node.name === 'pikasu-load') {
    return transformLoad(t, path, imports)
  }

  throw new Error(`Unknown directive: '${path.node.name}'`)
}

function transformLoad(
  t: BabelTypes,
  path: NodePath<babel.types.JSXIdentifier>,
  imports: ImportElement[],
) {
  const clientAttr = path.parentPath
  clientAttr.remove()

  const component = clientAttr.parentPath?.parentPath
  if (!component?.isJSXElement()) return

  const componentId = component.node.openingElement.name
  if (!t.isJSXIdentifier(componentId)) return

  const source = imports.find(x => x.items.includes(componentId.name))?.source
  if (!source) return

  const attrs = component.node.openingElement.attributes
  const props = attrs.length > 0 ? jsxAttrsToObject(t, attrs) : null

  const pikasuAttrs = [t.jsxAttribute(t.jsxIdentifier('data-pikasu'), t.stringLiteral(source))]
  if (props) {
    pikasuAttrs.push(
      t.jsxAttribute(
        t.jsxIdentifier('data-props'),
        t.jsxExpressionContainer(
          t.callExpression(t.memberExpression(t.identifier('JSON'), t.identifier('stringify')), [
            props,
          ]),
        ),
      ),
    )
  }

  component.replaceWith(
    t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('div'), pikasuAttrs),
      t.jsxClosingElement(t.jsxIdentifier('div')),
      [component.node],
    ),
  )

  return { dynamicSource: source }
}

function jsxAttrsToObject(
  t: BabelTypes,
  attrs: (babel.types.JSXAttribute | babel.types.JSXSpreadAttribute)[],
): babel.types.ObjectExpression {
  const props: (babel.types.ObjectProperty | babel.types.SpreadElement)[] = []

  for (const attr of attrs) {
    if (t.isJSXSpreadAttribute(attr)) {
      props.push(t.spreadElement(attr.argument))
      continue
    }

    const { name, value } = attr

    const id = name.name
    const objKey = typeof id === 'string' ? id : id.name
    const objValue = t.isStringLiteral(value)
      ? value
      : t.isJSXExpressionContainer(value)
        ? t.isExpression(value.expression)
          ? value.expression
          : null
        : null

    if (!objValue) continue
    props.push(t.objectProperty(t.stringLiteral(objKey), objValue))
  }

  return t.objectExpression(props)
}
