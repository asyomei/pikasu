import type { JSX as _ } from 'solid-js'

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicAttributes {
      'client:load'?: true
    }
  }
}
