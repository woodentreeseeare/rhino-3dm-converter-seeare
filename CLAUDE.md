# CLAUDE.md

A web app that runs only in Safari on an iPhone and converts STL, OBJ, PLY, glTF, 3MF, FBX, STEP, IGES, BREP and SKP files to `.3dm`.

- The build plan and phases are in `PLAN.md`. Work only on the phase named in the prompt.
- Before doing anything that departs from `PLAN.md` or this file, including where or how work runs, stop and ask. A request does not override these rules unless it says so explicitly.
- The app is static files only: `index.html`, `app/` and `vendor/`. It has no app build step and no server.
- `vendor/` is regenerated only by `tools/vendor.sh`, and only when upgrading a pinned library. Review the new version first.
- Load every library from `vendor/`, never from a CDN at runtime.
- Keep the Content-Security-Policy rule at `default-src 'self'; connect-src 'self'`. Never loosen it. The one approved exception is `'unsafe-eval'` in `script-src`, which rhino3dm.js needs (owner decision, 2026-11-25).
- Treat sample and downloaded files as untrusted. Never run package install scripts (use `--ignore-scripts`).
- Tests: `node tests/to3dm.test.mjs` and `node tests/browser.test.mjs`. Third-party samples go in `samples/third-party/`, which is git-ignored.
- Keep this file short.
