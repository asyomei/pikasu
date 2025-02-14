// @ts-check
// @ts-ignore
const dynamic = { './dir/Dynamic.js': () => import('./dir/Dynamic.js') }
// REPLACE

import { createComponent, hydrate } from 'solid-js/web'

document.addEventListener('DOMContentLoaded', async () => {
  const promises = []

  for (const el of document.querySelectorAll('[data-pikasu]')) {
    // @ts-ignore
    const { pikasu, props } = el.dataset
    const propsObj = props ? JSON.parse(props) : {}
    Object.assign(propsObj, {
      get children() {
        return Array.from(el.firstChild?.childNodes ?? [])
      },
    })
    promises.push(
      dynamic[pikasu]().then(mod => hydrate(() => createComponent(mod.default, propsObj), el)),
    )
  }

  await Promise.all(promises)
})
