export interface PikasuBuildOptions {
  /**
   * directory with public files available to client (e.g. `/favicon.ico`)
   * @default 'public/'
   **/
  publicDir?: string

  /** directory with source code and `pages` directory */
  srcDir: string

  /** directory with `server.mjs` and client files */
  outDir: string
}

/**
 * builds and bundles source to directory
 * `outDir` with `server.mjs` and client files
 * @example
 * ```ts
 * await pikasuBuild({
 *   srcDir: './src',
 *   outDir: './dist',
 * })
 * ```
 * after launch the server with `node dist/server.mjs`
 *
 * @param options build options
 */
export function pikasuBuild(options: PikasuBuildOptions): Promise<void>

export interface PageContext {
  params: Record<string, unknown>
}

/**
 * gets route params from route path
 * @example
 * ```ts
 * type Params = InferRouteParams<'/book/[id]'>
 * type Params = { id: string }
 *
 * type Params = InferRouteParams<'/books/[[id]]'>
 * type Params = { id?: string }
 * ```
 */
export type InferRouteParams<T extends string> = Simplify<PartToObject<T>>

type Simplify<T> = { [K in keyof T]: T[K] } & {}

type PartToObject<T extends string> = T extends `${string}[[${infer P}]]${infer R}`
  ? { [K in P]?: string } & PartToObject<R>
  : T extends `${string}[${infer P}]${infer R}`
    ? { [K in P]: string } & PartToObject<R>
    : {}
