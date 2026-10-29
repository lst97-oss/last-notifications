/**
 * Packages externalized during dev serve (`ssr.external`). Node's loader resolves
 * their CJS/UMD directly; letting Vite's dev SSR transform touch them can break
 * fragile UMD wrappers (e.g. `pluralize`, whose `this`-based global assignment
 * throws when transformed rather than required).
 *
 * Safe here whoever declared the entry: Node resolves from the importing package,
 * so pnpm's isolated layout never applies. The build is stricter — see
 * {@link buildBundledPackages}.
 */
export declare const ssrExternalPackages: string[];
/**
 * Entries of {@link ssrExternalPackages} that must bundle in the production build.
 *
 * Externalizing only works for specifiers resolvable from the project root. These
 * are leaf deps of Payload packages, so under pnpm they live in `.pnpm/…` and a bare
 * specifier in a root-resolved chunk is invisible — `ERR_MODULE_NOT_FOUND` at
 * runtime, or a build-time resolve failure under Nitro's re-bundle pass.
 *
 * `pluralize` also needs forcing back via `noExternal` (see `withPayload`); the
 * storage leaves don't, since their adapters are already `noExternal`.
 */
export declare const buildBundledPackages: string[];
/** Server-only package boundaries loaded directly by Node in development and production. */
export declare const serverExternalPackages: string[];
/** Additional installed packages that can bypass Vite's development server transforms. */
export declare const devExternalPackages: string[];
/**
 * Externalizes package boundaries so packages resolve their own transitive dependencies under pnpm.
 * Leaves that must bundle in production are excluded; see {@link buildBundledPackages}.
 */
export declare const buildExternalPackages: string[];
export declare const payloadNoExternalPatterns: Array<RegExp | string>;
//# sourceMappingURL=external.d.ts.map