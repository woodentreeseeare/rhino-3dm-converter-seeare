# 3DM Converter

A web app that runs in Safari on an iPhone and converts 3D files to Rhino `.3dm` files. Conversion happens entirely on the device, and no files are uploaded.

The build plan is in [PLAN.md](PLAN.md).

## Status

Phases 1–5 of `PLAN.md` are implemented and pass the browser tests, including an offline run. What remains is the check on a real iPhone.

## Deploy

`.github/workflows/pages.yml` publishes `index.html`, `sw.js`, `manifest.webmanifest`, `app/` and `vendor/` to GitHub Pages on every push to `main`. When adding a runtime file, also add it to `PRECACHE` in `sw.js`; the browser test fails if one is missing.

## Run locally

Serve the folder with any static server, for example `python3 -m http.server`, then open `http://localhost:8000/`.

## Tests

- `node tests/to3dm.test.mjs`: builds a `.3dm` file in Node and reads it back.
- `node tests/browser.test.mjs`: converts every file in `samples/` in headless Chromium at iPhone size, checks the page fits at 320–430 px wide, checks the service worker, then repeats the conversions offline.
