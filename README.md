# 3DM Converter

A web app that runs in Safari on an iPhone and converts 3D files to Rhino `.3dm` files. Conversion happens entirely on the device, and no files are uploaded.

The build plan is in [PLAN.md](PLAN.md).

## Status

Phases 1–4 of `PLAN.md` are implemented. See the status note in `PLAN.md`: one Content-Security-Policy decision is still open before the app works in a browser.

## Run locally

Serve the folder with any static server, for example `python3 -m http.server`, then open `http://localhost:8000/`.

## Tests

- `node tests/to3dm.test.mjs`: builds a `.3dm` file in Node and reads it back.
- `node tests/browser.test.mjs`: converts every file in `samples/` in headless Chromium at iPhone size.
