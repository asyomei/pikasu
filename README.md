# pikasu
micro framework for solid-js, which enables partial hydrating

## usage
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
