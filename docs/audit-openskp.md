# OpenSKP targeted security review (level 2A)

- **Package:** `openskp` **1.7.0** (npm). MIT license. Single maintainer: `iamahsanmehmood`.
- **npm integrity:** `sha512-QZTZBP/4+kZ7cAqG4aN84HBlv8l4u+B3sS/E3WbkUJcv1hgdw0jao4aMCHk+0P0c3qImOj4DfWeEAsZVyTua6Q==`
- **Source commit (`gitHead`):** `506bcbd8a0e3dfcca26898aef040eeb11dc00d29` on https://github.com/iamahsanmehmood/openskp
- **Review date:** 2026-11-25
- **Scope:** A targeted review, not a line-by-line read and not a professional audit. It looks for supply-chain risks: hidden network access, code that runs other code, data leaving the page, and published files that differ from the source.

## Verdict

**No blocking issues were found for this app's use.** That use is parsing files the user picked, in the browser, with the page blocked from connecting to other sites.

## Checks and results

### 1. Install-time scripts
**Result: none.** The published `package.json` has no `preinstall`, `install` or `postinstall` scripts. `postbuild` runs only when building from source.

### 2. Risky APIs in `dist/index.mjs`
The file is 19,501 lines and was searched for each of these:

| Pattern | Hits |
|---|---|
| `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` | 0 |
| `eval(`, `new Function`, `Function(`, dynamic `import(`, `importScripts` | 0 |
| `postMessage`, `Worker(` | 0 |
| `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB` | 0 |
| `navigator.`, `location.`, `window.`, `globalThis` | 0 |
| `http://`, `https://` URLs | 0 |
| `process.env`, `child_process` | 0 |
| `require(` | 2 |
| `atob(` | 2 |
| `crypto` | 2 |

Each hit was read in context:
- **`require(`** comes from `src/node-builtins.ts`. It loads Node's `fs` and `path`, and is called only by the Node-only export functions (`exportOBJ`, `exportSTL`, `exportPLY`, `exportDXF`, `exportIFC`, `readFileToArrayBuffer` and `.save()`). The browser path (`buildScene` on an `ArrayBuffer`) never calls them.
- **`atob(`, first use:** `toCode` writes generated JavaScript as text, which embeds texture bytes. That text is returned, never run.
- **`atob(`, second use:** `loadScaffold` decodes `SCAFFOLD_BASE64`. That is a 5,796-byte blob, and decoded it is an empty SketchUp 17.0.1 model: its header is `SketchUp Model {17.0.1}`, followed by SketchUp class names (`CArcCurve`, `CAttribute` …). It is the template for the `.skp` writer. It is not code.
- **`crypto`:** `crypto.getRandomValues` generates GUIDs for written files.

The search also found 2 long base64 strings and 1 long hex string. The base64 strings are the scaffold blob above. The hex string is a constant lookup table inside the scaffold module.

### 3. Published files match the source
The library was built from the source at `gitHead`, in `packages/typescript`:
1. `npm ci --ignore-scripts`
2. `tsup src/index.ts --format cjs,esm --dts`
3. The output was compared with the npm tarball.

| File | Result |
|---|---|
| `dist/index.js` | byte-identical |
| `dist/index.mjs` | byte-identical |
| `dist/index.d.ts` | byte-identical |
| `dist/index.d.mts` | byte-identical |

The npm package therefore contains exactly what the public source produces. No code was injected at publish time.

### 4. Dependencies
| Package | Pinned | Latest on npm today | Install script | Network / eval APIs | Advisories |
|---|---|---|---|---|---|
| `earcut` | 3.2.4 | 3.2.4 | no | none | none (`npm audit`: 0) |
| `fflate` | 0.8.3 | 0.8.3 | no | none¹ | none |
| `flatbuffers` | 25.9.23 | 25.9.23 | no | none | none |

¹ `fflate` can start a Web Worker from a `blob:` URL, but only in its async API. OpenSKP uses only `unzipSync`. The app's `worker-src 'self'` policy would block a `blob:` worker anyway.

## Residual risk

- **Parser bugs.** A malformed `.skp` file could crash parsing or produce wrong geometry. The impact is limited to that conversion, because the file is the user's own and the page cannot send data out.
- **Future versions are not covered.** This review covers 1.7.0 only, and new versions are released often. `tools/package.json` pins exact versions; repeat this review before upgrading.
- **Bundling.** `vendor/openskp.js` is an esbuild bundle of the reviewed code plus the three dependencies, tree-shaken down to `buildScene`. `vendor/SHA256SUMS` records its hash, and `tools/vendor.sh` rebuilds it from the lockfile.

## Sources
- Package: https://www.npmjs.com/package/openskp
- Repository: https://github.com/iamahsanmehmood/openskp
- npm `gitHead` and integrity: `npm view openskp@1.7.0 gitHead dist.integrity`
