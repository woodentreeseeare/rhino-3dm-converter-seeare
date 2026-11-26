# C4D support: plan for Phases 6 and 7

This file is safe for a clean-room session to read. It holds requirements, public facts and the test method, and nothing taken from rindr's source code. Do not add any.

- **Status:** C4D is approved as a planning item only (owner, 2026-11-26). The implementation path is not chosen yet.
- **Background:** `docs/c4d-sweep.md` found one reverse-engineered reader, rindr, under PolyForm Noncommercial 1.0.0. It found no reader under a permissive licence.

## Two paths, one decision gate

| | Path A: adapt rindr | Path B: clean-room reader |
|---|---|---|
| Licence of the result | PolyForm Noncommercial 1.0.0 for the reader. The app must stay non-commercial | Any licence the owner picks, such as MIT |
| Effort | Low to medium: harden it, then write a mapping layer | High: format analysis from sample files |
| Risk | Licence fit; rindr's own claims are unverified | Coverage and time; it needs many sample files |
| Session rule | May read `docs/c4d-rindr-analysis.md` | Must not read `docs/c4d-rindr-analysis.md`, `docs/c4d-sweep.md` or any rindr source, and must not search for rindr |

**Phase 6 is the same for both paths** and comes first. The owner chooses the path after Phase 6, when real test results exist.

## Phase 6: groundwork (path-neutral)

### Prerequisite from the owner

Cinema 4D is needed only to make the test files. A licence or trial can be checked at https://www.maxon.net (trial terms unverified). The owner provides `.c4d` files in `samples/third-party/c4d/`, which is git-ignored. For each file, the owner also provides an OBJ exported from Cinema 4D with the same settings every time.

The set:
1. A small reference scene with these parts:
   - an editable polygon cube;
   - a triangle;
   - an n-gon;
   - two nested null groups with non-zero position, rotation and scale (one using HPB rotation order, one using XYZ);
   - two materials with different colours.

   Save it in as many versions as available: R12 or the oldest available, R16, R20, R23, R25, 2023, 2024, 2025 and 2026.
2. The same scene with the primitives left parametric, not made editable. Save it once normally, and once with any "save polygons for Cineware/Melange" option switched on. The option name is from memory and unverified.
3. Two or three real production scenes, as large as can be shared.
4. A scene in metres and a scene in millimetres, to test units.

### Steps

1. **Corpus manifest.** Create `tests/c4d-corpus.json`, listing each file's name, SHA-256, Cinema 4D version and what it contains. The files themselves stay out of git.
2. **Ground-truth comparison tool.** Write `tests/c4d-compare.mjs`. It loads the OBJ with the app's existing OBJ path and compares it with the C4D reader's output. It checks:
   - triangle count;
   - axis-aligned bounding box, per object and overall, to 1e-4 relative;
   - total surface area to 1e-3 relative;
   - the layer and object names.

   This tool is the test for any reader on either path. It proves geometry is correct, not only that a file loads.
3. **Robustness harness.** Write `tests/c4d-fuzz.mjs`. It mutates corpus files in memory with these mutations:
   - bit flips;
   - truncation at random points;
   - very large 32-bit length and count fields;
   - deep repeated nesting;
   - zero-length blocks.

   The reader passes when it either succeeds or throws a normal `Error`. It must not hang for more than 5 s per file, and must not allocate more than 8× the file size plus 64 MB (measured with `process.memoryUsage()`). It runs in Node only, not in the page.
4. **Reader contract** (for `app/c4d/reader.js` on either path). It takes an `ArrayBuffer` and returns:
   `{ version, unit, objects: [{ name, layer, color, positions: Float32Array (world space, in the unit named by `unit`), indices: Uint32Array }], skipped: [{ type, count }] }`
   It must:
   - check every length, count and index against the buffer;
   - cap nesting depth and object count;
   - run in a Worker;
   - make no network, storage, `eval` or `Function` use;
   - return one clear error message for files it cannot read.
5. **Public facts only, for path B.** The file signature is `C4DC4D6` at offset 1. TestDisk checks `QC4DC4D6` at offset 0. PRONOM fmt/1180 describes the format as used from R12 on. Sources: https://raw.githubusercontent.com/nationalarchives/pronom/master/signatures/fmt/1180.json and https://raw.githubusercontent.com/cgsecurity/testdisk/master/src/file_c4d.c
6. **Run a quick baseline (optional, only if the owner allows running third-party code).** Download rindr's `c4d-parse.js` at commit `fccea41e2485b64d7695812d9df1f78b9a11f990` into a new, empty scratch directory. Do not vendor it. Read it in full before running it. Then run it through steps 2 and 3 and record the results in `docs/c4d-results.md`. This shows whether path A is worth taking. A session that does this step has seen rindr, so Phase 7 path B must then run in a new session (Rule 1 already requires one).
7. **Write `docs/c4d-results.md`** with:
   - corpus coverage per version;
   - the comparison results;
   - the fuzz results;
   - memory per MB of input;
   - a recommendation for path A or path B.

**Done when:** steps 1–4 and 7 are committed, and the owner has picked a path.

## Phase 7: implementation (the chosen path)

The goals are the same on both paths:
- Pass `tests/c4d-compare.mjs` on every reference file.
- Pass the fuzz harness with no hang or memory-budget breach.
- On parametric-only scenes, show a clear message: make objects editable in Cinema 4D (Current State to Object), or export OBJ or FBX.
- Add `c4d` to `FORMATS` in `app/convert.js`, update the format list in `CLAUDE.md` and `index.html`, and add the `.c4d` cases to `tests/browser.test.mjs`.
- Keep the Content-Security-Policy rule unchanged.

**Path A extra steps:**
- Vendor rindr's `c4d-parse.js` at a pinned commit through `tools/vendor.sh`, with a hash check and its licence in `vendor/licenses/`.
- Do the security review in the style of `docs/audit-openskp.md`.
- Fix the hardening items in a separate, clearly marked file.

**Path B extra steps:**
- Start from the public facts and the corpus only.
- Record every format finding in `docs/c4d-format.md` with the sample file that shows it, so the work can be checked as independent.

## Open questions for the owner

1. Is this app non-commercial (needed for path A)? The repository has no `LICENSE` file.
2. Is it acceptable to analyse `.c4d` files given Maxon's licence terms? This has not been checked.
3. Which Cinema 4D versions matter most?
