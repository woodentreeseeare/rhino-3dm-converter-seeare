# Cinema 4D (.c4d) reader sweep

- **Question:** Does any project parse the modern `.c4d` format (R12 and later) from its bytes, without Maxon's Melange or Cineware SDK, under a licence that allows vendoring into this static, browser-only app?
- **Date:** 2026-11-26
- **Scope:** Research only. No candidate was installed, cloned, built or run. Source was read as web pages through GitHub.
- **Limits of this sweep:** GitHub code search covers default branches only. The network policy of this session blocked `developers.maxon.net`, `www.nationalarchives.gov.uk`, `fileformats.archiveteam.org`, `formats.kaitai.io` and `superhivemarket.com`, so those pages were not read. Mirrors on GitHub were used where they exist.

## (c) Verdict

**One reverse-engineered reader was found: `schmarante/rindr`, file `src/scripts/c4d/c4d-parse.js`.** It is plain JavaScript, parses modern `.c4d` bytes itself and has no Melange, Cineware or Cinema 4D dependency.

**It cannot be vendored under the current licence unless this app is strictly non-commercial.** rindr is under the PolyForm Noncommercial License 1.0.0, and its `LICENSE.md` opens with "Required Notice: Commercial use is not covered by this license." This repository has no `LICENSE` file, so how the app is used decides whether that licence fits. That decision belongs to the owner.

**No reader under a permissive licence (MIT, BSD, Apache, ISC, MPL) was found.** Every other project that reads modern `.c4d` links Maxon's SDK, runs Cinema 4D, or calls an unidentified executable.

## (a) Verdict table

| Repository | Language | Last commit | Licence | Needs Melange / Cineware or Cinema 4D | C4D versions read | Evidence |
|---|---|---|---|---|---|---|
| [schmarante/rindr](https://github.com/schmarante/rindr) (`src/scripts/c4d/c4d-parse.js`) | JavaScript | 2026-11-17 (branch `develop`) | PolyForm Noncommercial 1.0.0 | **No** | Claimed: program versions 13 to 2026 (sample scenes), reverse-engineered on R18 files. Unverified. | Source and docs below |
| [syanenko/cinema2pov](https://github.com/syanenko/cinema2pov) | C++ | 2023-04-05 | AGPL-3.0 | **Yes** (Cineware SDK 22.008) | Whatever Cineware 22.008 reads | `C4DImportExport.cpp`: "// Based on Cineware SDK 22.008 Commandline Tool", `using namespace cineware;` |
| [assimp/assimp](https://github.com/assimp/assimp/tree/master/code/AssetLib/C4D) (C4D importer) | C++ | not checked | BSD-3-Clause (Assimp code) | **Yes** (Cineware, not bundled) | Whatever the installed Cineware reads | `C4DImporter.cpp` includes `c4d_file.h` and calls `LoadDocument(...)`. Root `CMakeLists.txt`: option `ASSIMP_BUILD_NONFREE_C4D_IMPORTER`, default `OFF`, "relies on the non-free Cineware SDK" |
| [THVFLM/Blender-Import-Maxon-Cinema-4D](https://github.com/THVFLM/Blender-Import-Maxon-Cinema-4D) | Python (compiled `.pyc`) and a bundled `.exe` | 2026-08-23 | GPL-3.0-or-later (manifest) | **Unknown converter.** Shells out to a bundled `c4d2fbx.exe`, then imports FBX | Not stated | `c4d2fbx.pyc` strings: `find_c4d2fbx_exe`, `subprocess.run(...)`, `bpy.ops.import_scene.fbx(...)`. Logic ships only as bytecode plus a Windows binary of unknown origin |
| [sigurdle/FirstProject2](https://github.com/sigurdle/FirstProject2/tree/master/src/LCinema4D) (`LCinema4D`) | C++ (Win32 COM) | 2020-08-18 (code from 2012) | None | No | **Old format only** (MC50 / v5-era numeric chunks), not R12+ | `DOK5.h`: `#define ID_MC50 MakeID('M','C','5','0')`. `DOK5Loader.cpp` skips a 16-byte header and reads chunk IDs 2000, 5020, 5100. README: "failed (incomplete,non-compilable) C++ projects" |

### rindr detail

All points come from reading the source and docs as web pages. They were not checked by running anything.

- **Own parser, no SDK.** Line 1 of `c4d-parse.js`: "// .c4d reader (.c4d) – own analysis of the file format (no public description; no third-party code)." The file has no imports, no network calls and no mention of Melange, Cineware or c4dpy. https://github.com/schmarante/rindr/blob/develop/src/scripts/c4d/c4d-parse.js
- **Format handled.** `const MAGIC = 'C4DC4D6';` is compared at bytes 1 to 7. The version is read with `getUint32(8)`, and a big-endian token stream starts at byte 13. The header comment gives an example version of 18057. The same signature appears in PRONOM fmt/1180 (offset 1, `C4DC4D6`) and in TestDisk/PhotoRec (`"QC4DC4D6"` at offset 0). Sources: https://raw.githubusercontent.com/nationalarchives/pronom/master/signatures/fmt/1180.json · https://raw.githubusercontent.com/cgsecurity/testdisk/master/src/file_c4d.c
- **What it extracts.** Polygon objects (points tag 5600, polygons 5604), UVs, normals, phong, texture tags, skin joints and weights, keyframe tracks, materials with bitmap names, transforms, lights and cameras. Other object types (generators, splines, deformers other than skin) go to an "unsupported" list. That suits this app, which needs meshes only.
- **Compression.** None in the parser. `docs/mesh-import.md` says "Unkomprimiert." https://github.com/schmarante/rindr/blob/develop/docs/mesh-import.md
- **Testing claims (unverified).** The doc says "Ohne Prüfung gegen das Programm" (not checked against Cinema 4D itself). It also says "Geprüft: alle Beispielszenen (85+ Dateien, Version 13–2026) und alle Testdateien laden ohne Fehler" and names a product scene saved by version 2023 with 391 objects. Loading without error is not the same as correct geometry.
- **Provenance claims (unverified).** The doc says "kein fremder Code, das Entwicklerpaket des Herstellers hat eine einschränkende Lizenz" and "eigene Analyse an vier Fassungen einer animierten Figur – Programm-Version R18". The commit history lists `claude` as a co-author on recent commits, so parts of the code appear to be AI-assisted. Whether the analysis is clean-room cannot be confirmed from the outside.
- **Robustness (relevant to untrusted input).** It has some checks: a minimum file size of 12 bytes, a "block beyond the end of the file" check, and loop guards against the buffer length. It has no upper limit on counts read from the file (for example `new Float64Array(count * 3)`), and polygon and joint indices are not checked against the point count. A hostile file could cause large allocations or out-of-range reads. In a browser these end as exceptions or memory pressure, not memory corruption.
- **Maintenance.** It is active: 261 commits, latest 2026-11-17. It is a single-author project with 2 stars. The C4D reader is part of a larger viewer app, not a package, and it has no npm release or version tag to pin.
- **Size.** `c4d-parse.js` is 530 lines (29,760 characters). It sits next to `c4d-build.js` and `c4d-worker.js`, which were not read.

## (b) Leads checked and ruled out

| Lead | Reason ruled out | Source |
|---|---|---|
| syanenko/cinema2pov (the open lead) | Uses the Cineware SDK; does not parse bytes itself | https://github.com/syanenko/cinema2pov · https://raw.githubusercontent.com/syanenko/cinema2pov/main/cinema2pov/source/C4DImportExport.cpp |
| Assimp mainline C4D importer | Needs the non-free Cineware SDK; off by default | https://github.com/assimp/assimp/blob/master/code/AssetLib/C4D/C4DImporter.cpp · https://raw.githubusercontent.com/assimp/assimp/master/CMakeLists.txt |
| Scott-Ayers/C4D-Mesh-Loader | README: "Make sure you have the Melange sdk on your computer." Source is only in a zip (not read). No licence; last commit 2017-04-21 | https://github.com/Scott-Ayers/C4D-Mesh-Loader |
| Glinkis/StepToCinema | Writes `.c4d` through Melange (`using namespace melange;`). No licence; last commit 2017-10-30 | https://github.com/Glinkis/StepToCinema · https://raw.githubusercontent.com/Glinkis/StepToCinema/master/source/StepToCinema.cpp |
| THVFLM/Blender-Import-Maxon-Cinema-4D | Calls a bundled, unidentified `c4d2fbx.exe` (Windows-only). The core logic is a `.pyc`, not readable source. Not usable in a browser | https://github.com/THVFLM/Blender-Import-Maxon-Cinema-4D |
| Superhive (Blender Market) "Maxon Cinema 4D File Import-Export" add-ons | Paid, closed products. Pages blocked here, so the method used is **unverified** | https://superhivemarket.com/products/maxon-cinema-4d--file-import-export-convenient-script |
| sigurdle/FirstProject2 `LCinema4D` | Old v5-era (MC50) layout only, mostly stubs, no licence | https://github.com/sigurdle/FirstProject2/tree/master/src/LCinema4D |
| DriverUnload/cve-2024-25423 | A CVE proof-of-concept file (`poc.c4d`) for Cinema 4D R2024.2.0. No parser and no format description | https://github.com/DriverUnload/cve-2024-25423 |
| TestDisk / PhotoRec `file_c4d.c` | File carving only: checks the 8-byte `QC4DC4D6` header, no parsing. GPL-2.0-or-later | https://raw.githubusercontent.com/cgsecurity/testdisk/master/src/file_c4d.c |
| Its-Just-Nans/wombat, mmalecot/file-format, Asuan/mimetype-detector, TrID database | Signature tables for file-type detection only | https://github.com/Its-Just-Nans/wombat/blob/main/src/format/mod.rs (others found by code search, not opened) |
| libmagic (`file`) `Magdir/iff` | Only the old IFF form: `>8 string MC4D ... MaxonCinema4D rendering`. No modern signature | https://raw.githubusercontent.com/file/file/master/magic/Magdir/iff |
| PRONOM fmt/1180 (Cinema 4D 6+) | Gives the signature only (offset 1, `C4DC4D6`). The note says it is "Based on private_headers.h from the Melange SDK v5". No structure is described | https://raw.githubusercontent.com/nationalarchives/pronom/master/signatures/fmt/1180.json |
| Kaitai Struct format gallery | `3d/` holds only `gltf_binary.ksy`; there is no c4d `.ksy`. `formats.kaitai.io` was blocked here | https://github.com/kaitai-io/kaitai_struct_formats/tree/master/3d |
| Noesis | No evidence of `.c4d` support found. Noesis is closed-source and Windows-only in any case. **Unverified** | https://www.richwhitehouse.com/index.php?content=inc_projects.php&showproject=91 |
| Python packages for Cinema 4D (c4dtools, nr.c4d, `seeminglee/c4d` stubs, FUSEE Uniplug) | Use or wrap Cinema 4D's own Python or C++ API | https://github.com/edgency/c4dtools · https://libraries.io/pypi/c4dtools |
| Code search: `"MC50"` (C, Python, Rust), `"MC4D" header`, `"without melange"`, `melange "clean room"`, c4d parser in Rust, Go and TypeScript | Hits were unrelated (hardware sensors, the OCaml Melange compiler, a game named Melange, C4-model diagram tools). The only Cinema 4D hit was sigurdle/FirstProject2 (above) | `gh api search/code`, 2026-11-26 |
| Repository search: "c4d parser", "c4d reader", "cinema4d format", "c4d file format", "c4d importer", "c4d loader", "melange c4d" | Results were Cinema 4D plugins that import other formats into C4D, or the projects listed above | `gh api search/repositories`, 2026-11-26 |
| Web search: forums, format wikis, forensics writeups | No other reverse-engineered reader found. Maxon's forum says it cannot share details of the binary format | https://developers.maxon.net/forum/topic/14736/how-to-extract-thumbnail-image-from-c4d-file-without-cinema-4d-installed/3 (search snippet; page blocked here) |

## (d) Next steps, if rindr is pursued

None of these should start without an owner decision. This document does not recommend installing or running any candidate.

1. **Licence decision (blocking).** The owner has to decide whether this app is non-commercial under PolyForm Noncommercial 1.0.0 (https://polyformproject.org/licenses/noncommercial/1.0.0), or ask the rindr author for a separate licence for `c4d-parse.js`. This repo has no `LICENSE` file, so its own licence also needs settling first.
2. **Security review like `docs/audit-openskp.md`,** pinned to one commit hash, since rindr has no releases. It should read `c4d-parse.js`, `c4d-build.js` and `c4d-worker.js` in full. Specific items: unbounded allocations from file-supplied counts, unchecked polygon indices, and any network, `eval` or `Function` use.
3. **Provenance check.** Look for evidence that the code was not derived from Melange or Cineware headers. The project says it was not, but this is unverified.
4. **Planning.** C4D is not in `PLAN.md` or the supported-format list in `CLAUDE.md`. Adding it would be a new phase, which the owner would have to approve, plus a test corpus of `.c4d` files kept in `samples/third-party/`.

## Unverified claims, collected

- rindr's version range (13 to 2026), its test results, and its "no third-party code" and own-analysis claims are the project's own statements.
- What the Superhive add-ons and Noesis do with `.c4d`. Their pages were not readable here.
- What `c4d2fbx.exe` in the Blender add-on is, or where it comes from.
- Part of `docs/mesh-import.md` in rindr (about the last 35,000 characters) was only summarised, not read word for word.
- The contents of the Scott-Ayers source zip.
