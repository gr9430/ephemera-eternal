# Clip Art Panel — Design Spec

**Status:** Approved in conversation, pending written-spec review
**Owner:** Glenn S. Ritchey III
**Extends:** `2026-08-27-zineworkshop-design.md`

## Purpose

Add a "Clip Art" panel: a set of pre-cut, transparent-background fragments
(pieces of Glenn's flyers, and non-human-subject images from a co-presenter
with permission) that participants can place on the canvas as collage
material. The flyer gallery stays as whole images to reflect on; clip art is
scrap to build with.

Pieces are prepared ahead of time by Glenn. There is no in-app cutting tool.

## Content constraints

- Subjects are non-human. Glenn is selecting; the tool does not enforce this.
- Every piece must have permission cleared. `provenance` records how
  (e.g. `own work`, `co-presenter, permission granted`).

## Data: `data/clipart.json`

Array of entries:

```json
{
  "id": "clip_lamp_001",
  "src": "images/clipart/lamp.png",
  "alt": "Black ink wall-mounted street lantern with curled iron bracket",
  "source": "flyer or origin the piece was cut from",
  "credit": "artist / photographer",
  "provenance": "own work | co-presenter, permission granted",
  "tags": []
}
```

- Required: `id`, `src`, `alt`, `credit`, `provenance`.
- Optional: `source`, `tags`. `tags` is stored but unused in v1 so a filter can
  be added later without re-entering data.
- Seeded with `images/clipart/lamp.png` (848x1080 RGBA PNG) as the only entry.

## UI

- New panel in `index.html` directly after the curated flyer gallery.
- Flat thumbnail grid (no grouping, no filters), rendered on a checkerboard
  background so transparency is visible.
- Each thumbnail shows visible credit text beneath it; `title` includes the
  source flyer when present.
- Clicking a piece places it via the existing `createImageElement` /
  `addElement` path, so it is dragged, resized, and layered like any image
  element. Initial size preserves aspect ratio and is scaled to fit the page
  rather than placed at native pixel size.
- No upload control.

## Code

- `js/clipart.js` — modeled on `js/gallery.js`: fetch `data/clipart.json`,
  store in `state.clipartImages`, render the panel, place on click. Shares
  or mirrors `formatCredit`.
- `js/store.js` — add `clipartImages` to state. JSON save/load is unchanged
  because placed pieces are ordinary image elements.
- `css/generator.css` — checkerboard thumbnail and panel styles.
- `js/clipart.test.js` — same plain-JS style as the existing tests: credit and
  title formatting, fit-to-page sizing, and a check that every
  `clipart.json` entry has the required fields.

## Out of scope for v1

- In-app cropping/cutting tool.
- Participant upload.
- Tags/filter chips, grouping by source flyer.
- Automatic flyer-splitting script.

## Docs and follow-ups

- Update the original spec (location is now the repo root, not
  `/transfer/zineworkshop/`) and add an "Adding clip art" note to the README.
- **Open discrepancy, not part of this work:** `js/editor.js` still contains
  file-upload code (around line 858) although the original spec says no
  participant upload. Needs a decision before the workshop.
