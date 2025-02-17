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
