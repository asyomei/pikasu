# pikasu

micro framework for solid-js, which enables partial hydrating

## usage

```sh
npm i @pyonpyon/pikasu fastify
yarn add @pyonpyon/pikasu fastify
pnpm add @pyonpyon/pikasu fastify
```

```js
// file: build.mjs
import { pikasuBuild } from '@pyonpyon/pikasu'

await pikasuBuild({
  srcdir: './src',
  outdir: './dist',
})
```

`node build.mjs`

`node dist/server.mjs` after building to launch the server

## overview

the `pages/` directory acting like routes:

- `pages/index.tsx -> /`
- `pages/some/path.tsx -> /some/path`
- `pages/foo/index.tsx -> /foo`

all components are static by default. to make the component dynamic, add the `pikasu-load` attribute:

```tsx
return (
  // props will be JSON.stringify'ed, so only primitive values allows
  <DynamicComponent pikasu-load foo="bar">
    <SomeComponent />
  </DynamicComponent>
)
```

the output of component will send to client as is, so define layout with html structure:

```tsx
// file: layouts/DefaultLayout.tsx
import type { ParentProps } from 'solid-js'

export default function DefaultLayout({ children }: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>website</title>
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

```tsx
// file: pages/index.tsx
import DefaultLayout from '#/layouts/DefaultLayout.tsx'

export default function MainPage() {
  return (
    <DefaultLayout>
      <p>hi world!</p>
    </DefaultLayout>
  )
}
```

to get server-side data, define the function `getServerSideProps`:

```tsx
type Props = Awaited<ResultType<typeof getServerSideProps>>

export async function getServerSideProps() {
  const data = await fetchSomeData()
  return { data }
}

export default function Page({ data }: Props) {
  // doing somewhat with data
  return <Layout>...</Layout>
}
```

pikasu also supports *.css and *.module.css importing:

```tsx
import './styles.css'
import styles from './Component.module.css'

export default function Component() {
  return (
    <div class={styles.foo}>...</div>
  )
}
```

to add types for css imports:
- add `"@pyonpyon/pikasu/client"` to `types` in `tsconfig.json`
- or make `src/env.d.ts` file
  ```ts
  /// <reference types="@pyonpyon/pikasu/client" />
  ```
