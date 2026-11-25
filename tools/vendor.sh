#!/usr/bin/env bash
# Refreshes vendor/ from the exact versions pinned in tools/package.json and package-lock.json.
# Run only when upgrading a library, after reviewing the new version (see PLAN.md, Phase 1).
set -euo pipefail
cd "$(dirname "$0")"
npm ci --ignore-scripts --no-audit --no-fund
V=../vendor
mkdir -p "$V"
ES=./node_modules/.bin/esbuild
"$ES" entry-three.js --bundle --format=esm --platform=browser --minify --legal-comments=eof --outfile="$V/three-loaders.js"
"$ES" entry-openskp.js --bundle --format=esm --platform=browser --legal-comments=eof --outfile="$V/openskp.js"
cp node_modules/rhino3dm/rhino3dm.module.js node_modules/rhino3dm/rhino3dm.wasm "$V/"
cp node_modules/occt-import-js/dist/occt-import-js.js node_modules/occt-import-js/dist/occt-import-js.wasm "$V/"
mkdir -p "$V/licenses"
cp node_modules/three/LICENSE "$V/licenses/three.txt"
cp node_modules/rhino3dm/README.md "$V/licenses/rhino3dm-README.md"
cp node_modules/occt-import-js/dist/license.occt-import-js.txt node_modules/occt-import-js/dist/license.occt.txt "$V/licenses/"
cp node_modules/openskp/LICENSE "$V/licenses/openskp.txt"
cp node_modules/earcut/LICENSE "$V/licenses/earcut.txt"
cp node_modules/fflate/LICENSE "$V/licenses/fflate.txt"
cp node_modules/flatbuffers/LICENSE "$V/licenses/flatbuffers.txt" 2>/dev/null || true
( cd "$V" && sha256sum *.js *.wasm > SHA256SUMS )
echo "vendor/ refreshed"
