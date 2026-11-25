# CLAUDE.md

A web app that runs only in Safari on an iPhone and converts STL, OBJ, PLY, glTF, 3MF, FBX, STEP, IGES, BREP and SKP files to `.3dm`.

- The build plan and phases are in `PLAN.md`. Work only on the phase named in the prompt.
- There is no build step and no server. Ship static files only: `index.html` and `vendor/`.
- Load every library from a local copy in `vendor/`, at the exact version in `vendor/VERSIONS.md`. Never load from a CDN at runtime.
- Keep the Content-Security-Policy rule at `default-src 'self'; connect-src 'self'`. Never loosen it.
- Treat sample and downloaded files as untrusted. Never run package install scripts from dependencies.
- Keep this file short.
