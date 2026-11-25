# ARTEFACT DATUM

Measure a bike's fit and frame geometry from one side-on photo. Beta. (Named DATUM 2026-11-25, formerly "Photo Fit".)

Prototype (private artifact): https://claude.ai/artifact/WrCxUkqLR6TXUoTWrSbcZT

## What it does

- Traces both tires, solves the camera angle from them (tilt from squash, perspective from size difference) and
  rectifies the photo with a homography.
- Sets the scale from one or more known values: wheelbase (best), tire size, or saddle height.
- Corrects the BB for parallax: the chainring sits ~50 mm off the frame centerline (drive side), the crank bolt ~70 mm
  (non-drive side). Both editable.
- Setup wizard (tires, BB, scale), then Fit and Geometry tabs with draggable points. Yellow pulsing points still need
  placing; green ones are placed. A placed point goes yellow again if a later change moves it more than 0.5%.
- Steering axis with angle and left/right controls, each lockable. Seat tube straight or offset (experimental).
- Numbers and names follow the ARTEFACT geometry engine (`daniel-artefact/artefact-geo`, src/engine.js).
  ETERNA 52–60 comparison charts are solved by the engine (released sizes only).
- Undo/redo (Ctrl+Z / Ctrl+Y), measuring lines and circles, Monte Carlo ± on every number.

## Privacy

Pure client-side. The photo is read and processed in the browser and never uploaded. Only point positions are kept,
in the visitor's own browser storage. The only network requests are the Google Fonts stylesheet and the bundled
example photos.

## Layout

- `src/` app source: `index.html` (template), `style.css`, `core.js` (image processing, fitting), `app.js` (UI, numbers)
- `examples/` bundled example photos (ARTEFACT's own)
- `dist/` the built single-file page, as published in the artifact
- `tests/` Playwright smoke tests used during development (serve `dist/` on localhost:8001 first)
- `prototype/v0-original/` the first prototype this grew from, with its HANDOFF notes

## Build

    python3 build.py           # dist/index.html: the standalone page (as in the artifact)
    python3 build_shopify.py   # dist/shopify/datum.js: the Shopify theme bundle
    python3 -m http.server 8001 --directory dist

The Shopify bundle mounts the app in a shadow root inside `<datum-app>` (theme section `sections/datum.liquid`,
template `templates/page.datum.json`), so theme CSS and app CSS stay apart. It is plain ASCII so it reads the
same whatever charset it is served with. Example photos come from the section's image pickers (same-origin
`/cdn/shop/files/...` URLs).

## Hosting plan (decided 2026-11-25)

Built into the Shopify theme (Horizon Canvas) as its own page, not a separate host: no extra account to manage, and it
can later recommend ETERNA sizes and stems with live prices, Add to cart, and unlock advanced features for mailing-list
subscribers (Klaviyo). Being built first in an unpublished copy of the theme.

## Confidentiality

Only released geometry goes in here. Unreleased geometry (ETERNA 50, Ti, SYLEX, Big Leaf) and BikeCAD art stay in the
private engine repo.
