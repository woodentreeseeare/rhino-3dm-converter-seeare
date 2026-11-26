# rindr `.c4d` reader: code analysis

> **Clean-room warning.** This file describes rindr's source code. A session building a clean-room reader (Phase 7, path B in `PLAN.md`) must not read this file, `docs/c4d-sweep.md` or any rindr source. Use `docs/c4d-plan.md` only.

- **Reviewed:** `src/scripts/c4d/c4d-parse.js` (530 lines), `c4d-build.js` (331 lines) and `c4d-worker.js` (20 lines) from https://github.com/schmarante/rindr, branch `develop`, commit `fccea41e2485b64d7695812d9df1f78b9a11f990` (2026-11-17).
- **Method:** The files were downloaded as text into an empty scratch directory and read in full. None was run.
- **Licence:** PolyForm Noncommercial 1.0.0. See `docs/c4d-sweep.md`.
- **Date:** 2026-11-26. Line numbers below refer to that commit.

## 1. How it works

The reader has three layers.

1. **Tokenizer → chunk tree** (`c4d-parse.js` lines 59–160, class `Reader`). The file starts with an 8-byte magic, then a u32 version, then one byte. After byte 13 comes a single stream of big-endian tokens:
   - `0x01` opens a chunk (u32 id, u32 version) and `0x02` closes it.
   - Fixed-size scalars: u8, i32, u32, i64, f64, bool, time, vector, matrix.
   - Length-prefixed blocks: memory, UTF-16 strings, typed arrays.

   Every chunk becomes `{ id, ver, kids, vals }`. Chunk `110416` (animation keys) is collapsed into a small record as it is read.
2. **Interpreter** (lines 218–357). It walks well-known chunk ids:
   - `110308`: materials.
   - `110107`: objects.
   - `110050`, `110064`, `110100`: node data, node type and child list.
   - `110108`: tags. `110417`: tracks. `110052`: transform.

   It resolves cross-references through "link markers": 8 bytes that are the node's memory address when the file was saved. The output is a plain scene object: `{ version, unitMeters, objects[], materials[], unsupported[] }`, with geometry in typed arrays.
3. **Builder** (`c4d-build.js`). It turns that scene into a three.js tree. It mirrors the left-handed Y-up space on Z, splits quads, welds vertices, rebuilds phong normals, and builds skinning and an animation clip. Only the coordinate and rotation-order logic in this layer is useful to this app. The rest is three.js-specific.

`c4d-worker.js` runs the parse in a Web Worker and transfers the typed arrays without copying them.

## 2. Strengths

- **Small and dependency-free.** The parser imports nothing and makes no network, `eval`, `Function` or storage calls (the whole file was read).
- **Clean split** between tokenizing, interpreting and building. The scene object is close to what `app/convert.js` already takes (`{ name, layer, color, positions, indices }`).
- **Worker-based,** with transferable buffers. That suits iPhone memory and keeps the page responsive.
- **Format knowledge is written down** in comments (lines 1–30, 384–396, 471–474), including which findings are unconfirmed.
- **Field-tested on a real corpus,** by the author's account: 85+ sample scenes from versions 13 to 2026 (`docs/mesh-import.md`, unverified).

## 3. Defects that matter for untrusted files

Severity is rated for this app. Here, a crash ends as a caught exception in a Worker. Memory corruption is not possible in JavaScript, but tab-killing memory use is, and iOS Safari kills tabs that use too much memory.

| # | Where | Problem | Effect of a hostile or broken file | Severity |
|---|---|---|---|---|
| D1 | `readTag` 5600 / 5604 / 5671 (lines 425, 435, 442) | `count` comes from the file and is used directly in `new Float64Array(count * 3)` and similar | ~2³¹ count → multi-GB allocation attempt; negative → `RangeError` | High |
| D2 | `readTag` 5600 / 5604 (lines 428, 436) | Loops to `count` without checking the array's own `a.count` | Reads past the array → `RangeError` from DataView. Or reads neighbouring bytes of the file when the DataView is larger than `count` (no crash, wrong data) | Medium |
| D3 | Polygon indices (5604) | Not checked against the point count | Out-of-range indices produce `NaN` positions. In `c4d-build.js` the phong-limit path dereferences `trisAt[p]`, which is `undefined` (crash). A `.3dm` writer would get invalid meshes | High (for this app) |
| D4 | `tree()` (lines 69–94) | No limit on nesting depth or node count. 9 bytes per empty chunk → ~11 million JS objects from a 100 MB file | Memory exhaustion | Medium |
| D5 | `listItems`, `visit`, `walkShaders`, `readContainer` | Recursion depth set by the file | `RangeError: Maximum call stack size exceeded` | Low (caught) |
| D6 | `value()` fixed-size branch (line 101) | `this.p += size` is not checked against the buffer end | A truncated file → `RangeError` with an unhelpful message | Low |
| D7 | `arrayOf` (line 209) | A zero-length array token gives `length = -1` | `RangeError` | Low |
| D8 | UV lookup (`c4d-build.js` line 243) | UV tag count not checked against polygon count | `undefined` → `NaN` UVs | Low (UVs are not used by this app) |
| D9 | Strings (lines 119–122) | Built with `s +=` per character; the length comes from the file | Slow and memory-heavy on huge strings | Low |
| D10 | Whole design | Every scalar in the file becomes a JS value in a `vals` array | Memory use several times the file size. Large production scenes may not fit in an iPhone tab (unverified; needs measurement) | Medium |

## 4. Correctness risks (not security)

- **Values are read by position, not by key, in several places:**
  - key interpolation is `reals[3]` (line 158);
  - the light layout uses indexes 117–142 (line 401);
  - the transform takes vectors in order (line 370);
  - weights are split by marker position (line 480).

  The comments say these were found on sample files. A version that adds a field would shift them without any error.
- **The version is read but never used** (line 64). Files from unknown future versions are parsed the same way, with no warning.
- **Byte 0 of the magic is not checked** (line 41). TestDisk expects `Q` there. This is harmless for detection but undocumented.
- **No decompression.** The author's docs say the format is uncompressed. Whether any version or save option compresses chunks is unverified.
- **Units are fixed at 1 unit = 1 cm** (line 356). This is a deliberate choice after a scale bug, but a scene modelled in other units will convert with the wrong scale.
- **Parametric objects are not read.** That covers primitives (cube, sphere), generators (subdivision, extrude, cloner) and splines, which are listed under `unsupported`. Many real scenes are mostly parametric, so a mesh converter would output little or nothing for them. This is the largest coverage gap.
- **Polygon selections are not read,** so each object gets one material and one colour.

## 5. What this app would need from it

This app needs only world-space triangle meshes with a name, a layer and a colour (`app/convert.js`, lines 53–66 and 137). It does not need skinning, animation, lights, cameras or texture files. Of rindr's code, the relevant parts are:
- the tokenizer and tree, which need hardening;
- object, hierarchy, transform, points and polygons;
- material colour (container key 2100) for the layer colour;
- the rotation-order and mirroring logic from `c4d-build.js` (lines 22–44), to compose world matrices.

Roughly 60% of `c4d-parse.js` (lights, weights, tracks, render-plugin materials) and nearly all of `c4d-build.js` could be left out.

## 6. Improved development strategy (path A: adapt rindr)

1. **Vendor one file at a pinned commit, unmodified.** Store `c4d-parse.js` with its SHA-256 and the PolyForm licence text in `vendor/licenses/`. Fetch it in `tools/vendor.sh` and check the hash. Do not hand-edit vendored code.
2. **Harden it in a wrapper or a fork, not inline:**
   - Fix D1–D7 with checked reads: every length and count must satisfy `count × element size ≤ remaining bytes`.
   - Add caps: maximum chunk depth (for example 256), maximum node count and maximum total elements, derived from the file size.
   - Validate polygon indices against the point count.
   - Turn every failure into one clear error message. The PolyForm licence allows changes for non-commercial use, and changed copies must carry the licence and the Required Notice.
3. **Offer the fixes upstream** to the rindr author as issues, not code. This keeps the fork small.
4. **Write a converter layer in `app/`** (this app's own code) that maps the scene object to `parts`. It composes world matrices from the hierarchy, applies the mirror and axis change, triangulates and skips everything but meshes. The left-handed Y-up to right-handed Z-up mapping is likely `(x, y, z) → (x, z, y)` with reversed winding. This must be confirmed against a ground-truth export (`docs/c4d-plan.md` step 2).
5. **Test it the way `docs/c4d-plan.md` describes:** differential tests against OBJ exports, mutation fuzzing and a memory budget.

## 7. Facts in this file that came from rindr's code

Chunk ids, token codes, the header layout, the light layout and the link-marker scheme are all taken from rindr's source. They are the reason a clean-room session must not see this file.
