import { createComponent, hydrate } from 'solid-js/web'

declare const dynamic: Record<string, () => Promise<any>>

document.addEventListener('DOMContentLoaded', async () => {
  const promises = []

  for (const el of document.querySelectorAll('[data-pikasu]')) {
    const { pikasu, props } = (el as any).dataset
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
