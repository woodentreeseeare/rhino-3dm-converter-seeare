# Vendored libraries

`tools/vendor.sh` builds these from the exact versions in `tools/package.json` and `tools/package-lock.json`. `SHA256SUMS` holds the file hashes.

| Library | Version | License | Files |
|---|---|---|---|
| rhino3dm (McNeel) | 8.35.0 | MIT | `rhino3dm.module.js`, `rhino3dm.wasm` (copied unchanged) |
| three.js loaders | 0.187.0 | MIT | `three-loaders.js` (esbuild bundle: STL, OBJ, PLY, glTF, 3MF, FBX loaders) |
| occt-import-js | 0.0.23 | LGPL-2.1 (OCCT: LGPL-2.1 with exception) | `occt-import-js.js`, `occt-import-js.wasm` (copied unchanged) |
| openskp | 1.7.0 | MIT | `openskp.js` (esbuild bundle with earcut 3.2.4 ISC, fflate 0.8.3 MIT, flatbuffers 25.9.23 Apache-2.0) |

License texts are in `licenses/`. The openskp review is in `docs/audit-openskp.md`.
