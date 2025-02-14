export type BabelTypes = typeof import('@babel/core').types

export interface ImportElement {
  items: string[]
  source: string
}
