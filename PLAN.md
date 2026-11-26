# 3DM Converter: Build Plan

The goal is a web app that runs only in Safari on an iPhone and converts 3D files to Rhino `.3dm` files. It needs no server and no App Store app.

This plan splits the work into separate Claude Code sessions to save usage. Each session starts fresh in this repository, so the conversation it re-sends stays small. Run one phase per session. Paste the phase's prompt and check usage when the phase is done.

---

## Rules for every session

1. **One phase per session.** Start a new session for each phase. Do not keep going in a long one.
2. **Pick the model per phase.** Use `/model` to set the model listed for the phase. Sonnet handles the routine build work; Opus is kept for the security review.
3. **Check usage after each phase.** Run `/usage` in Claude Code, or open claude.ai → Settings → Usage. Write the result in the log at the bottom of this file.
4. **Keep context small.**
   - Point Claude at exact files rather than asking it to explore.
   - Do not paste whole libraries into the chat.
   - Keep `CLAUDE.md` short. It loads in every session.
5. **Commit at the end of each phase.** The next session then starts from the committed state, not from chat history.
6. **Stay inside the phase.** If something outside it comes up, add it to "Later" at the bottom instead of doing it now.

---

## Security rules for the app

- **Every library is a local copy at an exact, reviewed version.** All of them live in `vendor/`, and the app loads nothing from a CDN at runtime.
- **The page can only connect to its own site.** A Content-Security-Policy rule sets `connect-src 'self'` and `default-src 'self'`. The `'self'` value is needed because the WebAssembly files load from the same site. Even a compromised library then cannot send file data anywhere else.
- **Upgrades are deliberate.** A library is upgraded only after its new version passes the review in Phase 1.

---

## Status (2026-11-25)

Phases 1–4 are implemented, and all browser tests pass with the real Content-Security-Policy rule. The owner approved one exception: `'unsafe-eval'` in `script-src`, because rhino3dm.js creates functions at runtime. Phase 5 is implemented (manifest, service worker, Pages workflow); its remaining step is the real-iPhone check.

C4D (2026-11-26): Phases 6 and 7 are planned in `docs/c4d-plan.md`. The implementation path (adapt rindr, or a clean-room reader) is chosen after Phase 6.

---

## Phase 1: Targeted OpenSKP review (level 2A)

- **Model:** Opus. **Estimate:** ~20–40 min, ~50k–100k tokens.
- **Prompt to paste:**
  > Do a targeted security review of npm `openskp`, pinned to the current version (1.7.0 when this plan was written). Download the tarball into a new empty directory and do not run its scripts.
  > 1. Search `dist/index.js` for `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval`, `new Function`, dynamic `import(`, `importScripts`, `postMessage`, `document.cookie`, `localStorage`, and long base64 or hex strings. Read only the code around each hit.
  > 2. Build the library from the GitHub source at the matching tag and compare the output with the npm `dist` files. Report any differences.
  > 3. Check the pinned versions of `earcut`, `fflate` and `flatbuffers`, and look for security advisories on each.
  > 4. Write the findings to `docs/audit-openskp.md`, with sources, a verdict and the exact version reviewed.
  > Do not read the whole bundle line by line.
- **Done when:** `docs/audit-openskp.md` is committed.

## Phase 2: Core converter for mesh formats

- **Model:** Sonnet. **Estimate:** ~1–2 hrs.
- **Prompt to paste:**
  > Read `PLAN.md` (Security rules and Phase 2 only) and `CLAUDE.md`. Build `index.html` as one page, with its libraries in `vendor/`.
  > It needs:
  > - a file picker;
  > - three.js loaders for STL, OBJ, PLY, glTF/GLB, 3MF and FBX;
  > - conversion of each mesh into a `.3dm` file with rhino3dm.js, one layer per source object;
  > - a download of the result;
  > - the Content-Security-Policy rule from the security section.
  > Pin exact library versions and record them in `vendor/VERSIONS.md`. Test with small sample files in `samples/`.
- **Done when:** each mesh format converts and the `.3dm` file opens again in rhino3dm.

## Phase 3: STEP, IGES and BREP

- **Model:** Sonnet. **Estimate:** ~0.5–1 hr.
- **Prompt to paste:**
  > Read `PLAN.md` (Phase 3 only). Add occt-import-js, pinned and vendored, so STEP, IGES and BREP files convert into `.3dm` meshes. Run the conversion in a Web Worker so large files do not freeze the page. Show a clear message that the output is a mesh, not NURBS.
- **Done when:** sample STEP and IGES files convert.

## Phase 4: SKP support

- **Model:** Sonnet. **Estimate:** ~0.5–1 hr.
- **Requirement:** Phase 1 found no blocking issues.
- **Prompt to paste:**
  > Read `PLAN.md` (Phase 4 only) and `docs/audit-openskp.md`. Add `openskp` at the exact reviewed version, vendored. Convert SKP faces into `.3dm` meshes, and map groups and tags to Rhino layers. If a file fails to parse, show a fallback message: export the model as OBJ, or convert it in Rhino.
- **Done when:** sample `.skp` files convert. Test 2013–2020 files and 2021+ files.

## Phase 5: iPhone polish and testing

- **Model:** Sonnet. **Estimate:** ~0.5–1 hr.
- **Prompt to paste:**
  > Read `PLAN.md` (Phase 5 only). Add a web app manifest and a service worker so the app installs on the Home Screen and works offline. Test in headless Chromium with iPhone emulation, using every file in `samples/`. Check that the page fits the screen at phone width and has no horizontal scrolling. Set up GitHub Pages deployment.
- **Done when:** the deployed URL works on a real iPhone, and the output opens in iRhino 3D.

## Phase 6: C4D groundwork (path-neutral)

- **Model:** Sonnet. **Estimate:** ~1–2 hrs.
- **Requirement:** The owner has put `.c4d` reference files and matching OBJ exports in `samples/third-party/c4d/` (see `docs/c4d-plan.md`, "Prerequisite").
- **Prompt to paste:**
  > Read `PLAN.md` (Phase 6 only), `CLAUDE.md` and `docs/c4d-plan.md`. Do not read `docs/c4d-rindr-analysis.md`, `docs/c4d-sweep.md` or any rindr source, so a clean-room path stays open. Do steps 1–5 and 7 of Phase 6 in `docs/c4d-plan.md`: the corpus manifest, `tests/c4d-compare.mjs`, `tests/c4d-fuzz.mjs` and the reader contract. Do not change `vendor/`, `index.html` or `sw.js`. Skip step 6 unless the owner says otherwise. Write `docs/c4d-results.md` and commit.
- **Done when:** the comparison and fuzz tools run on the corpus, `docs/c4d-results.md` is committed, and the owner has chosen path A or path B.

## Phase 7: C4D reader (path chosen after Phase 6)

- **Model:** Opus (path A includes a security review; path B is format analysis). **Estimate:** path A ~2–3 hrs; path B several sessions.
- **Prompt to paste (path A):**
  > Read `PLAN.md` (Phase 7 only), `CLAUDE.md`, `docs/c4d-plan.md`, `docs/c4d-rindr-analysis.md` and `docs/c4d-results.md`. Follow Phase 7 path A in `docs/c4d-plan.md`. Vendor rindr's `c4d-parse.js` at the pinned commit through `tools/vendor.sh` with a hash check and its licence. Review it like `docs/audit-openskp.md`, fix defects D1–D7 in a separate marked file, and add the mapping layer in `app/c4d/`. Pass `tests/c4d-compare.mjs`, `tests/c4d-fuzz.mjs` and both existing test suites. Commit.
- **Prompt to paste (path B):**
  > Read `PLAN.md` (Phase 7 only), `CLAUDE.md`, `docs/c4d-plan.md` and `docs/c4d-results.md`. Do not read `docs/c4d-rindr-analysis.md`, `docs/c4d-sweep.md` or any rindr source, and do not search for it. Follow Phase 7 path B in `docs/c4d-plan.md`: build `app/c4d/reader.js` from the public facts and the sample files only, and record each finding in `docs/c4d-format.md`. Pass `tests/c4d-compare.mjs`, `tests/c4d-fuzz.mjs` and both existing test suites. Commit.
- **Done when:** every reference file passes the comparison, the fuzz harness passes, and `.c4d` files convert in the browser tests.

---

## Usage log

| Phase | Date | Model | Usage before → after | Notes |
|---|---|---|---|---|
| 1 | 2026-11-25 | Opus | not recorded | Phases 1–4 done in one session at the user's request. See docs/audit-openskp.md. |
| 2 | | Sonnet | | |
| 3 | | Sonnet | | |
| 4 | | Sonnet | | |
| 5 | 2026-11-25 | Sonnet | see /usage | Manifest, service worker, Pages workflow, offline tests. |
| 6 | | Sonnet | | C4D groundwork. |
| 7 | | Opus | | C4D reader, path A or B. |

## Later (out of scope for now)

- Server route with Rhino.Compute, for NURBS-quality STEP and SKP import.
- SVG, DXF and CSV point import as curves and points.

---

## Sources

- rhino3dm: https://github.com/mcneel/rhino3dm · https://developer.rhino3d.com/guides/opennurbs/what-is-rhino3dmio/
- occt-import-js: https://npmjs.com/package/occt-import-js
- OpenSKP: https://github.com/iamahsanmehmood/openskp · https://cdn.jsdelivr.net/npm/openskp@1.3.0/README.md
- iRhino 3D: https://www.rhino3d.com/ios/
- Rhino SKP import limits: https://docs.mcneel.com/rhino/8/help/en-us/fileio/sketchup_skp_import_export.htm
- Usage limits (third-party estimates): https://www.truefoundry.com/blog/claude-code-limits-explained
