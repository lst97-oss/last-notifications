# Vendored Payload TanStack Vite workarounds

Refreshed from `@payloadcms/tanstack-start@4.0.0-beta.4`
(`dist/withPayload/workarounds/*`, `dist/withPayload/config/{external,optimizeDeps}.js`
and `dist/withPayload/importProtection.js`) on 2026-10-27.
`clientModuleResolution.js` retains the equivalent local Bun file/path APIs.
Not vendored: beta.4's `workarounds/stubPrettierInClient.js` (only used by the
full wrapper, which this repo does not run).

The full adapter wrapper previously made every route return 404 on this TanStack
line. These workarounds preserve the proven plugin order and let Start own the
RSC handler (`serverHandler: false`). Keep the wrapper out until `/admin` is
verified to route correctly with it.

Refresh these files after each adapter upgrade. Remove them once the upstream
wrapper is verified against the application's boot contract.
