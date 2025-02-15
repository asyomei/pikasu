declare module '*.module.css' {
  const styles: CSSModule
  export default styles
}

declare module '*.css'

interface CSSModule {
  readonly [className: string]: string
}
