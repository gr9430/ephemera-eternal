# Zine Workshop

A standalone, Jekyll-free zine-making tool for an anti-gentrification
workshop, forked from `tools/ziner/`. Adds four optional panels alongside the
existing drag-and-drop canvas:

- **Poetry Generator** — a Tracery-style grammar (`data/grammar.json`)
  participants can generate lines from, insert as editable text elements, or
  ignore entirely in favor of typing their own text (already supported by
  every text element). Participants can also add their own words to the
  grammar's Word Bank during the session — those additions are not saved
  back to `data/grammar.json`.
- **Flyers & Images** — a curated, permission-cleared gallery
  (`data/gallery.json`) participants can place on the canvas. No participant
  upload in this exercise.
- **Clip Art** — pre-cut, transparent-background collage pieces
  (`data/clipart.json`) participants can place on the canvas as building
  material. Prepared ahead of time; no in-app cutting and no upload.
- **Photos** — a curated set of whole photos (`data/photos.json`), currently
  Adam Goldman's documentary photos of the Free Uncle Lou / Uncle Lou's
  Music Bar campaign. Placed on the canvas the same way as the other
  panels; no participant upload.

## Adding flyers

1. Put the flyer image into `images/flyers/`.
2. Add an entry to `data/gallery.json`:

   ```json
   { "id": "flyer_example", "src": "images/flyers/example.jpg",
     "alt": "what the flyer shows and says, for screen readers",
     "credit": "artist", "caption": "show date as printed",
     "provenance": "own work | permission granted" }
   ```

   The panel shows `credit — caption` under each thumbnail. Every flyer
   needs permission cleared.

## Adding clip art

1. Export the piece as a transparent-background PNG into `images/clipart/`.
2. Add an entry to `data/clipart.json`:

   ```json
   { "id": "clip_lamp_001", "src": "images/clipart/lamp.png",
     "alt": "what the piece shows, for screen readers",
     "source": "flyer it was cut from (optional)",
     "credit": "artist / photographer",
     "provenance": "own work | co-presenter, permission granted",
     "tags": [] }
   ```

   `id`, `src`, `alt`, `credit`, and `provenance` are required. Every piece
   needs permission cleared. Clip art (Glenn's own flyer art) may include
   human figures; the non-human-subject rule applies to the Photos panel
   only (see below), not to clip art.
3. Run `node js/clipart.test.js` — it checks every entry has the required
   fields, unique ids, and an image file that exists.

## Adding photos

1. Add the photo file into `images/<source>/` (e.g. `images/goldman/`).
2. Add an entry to `data/photos.json`:

   ```json
   { "id": "photo_example", "src": "images/goldman/example.jpeg",
     "alt": "what the photo shows, for screen readers",
     "credit": "photographer's name",
     "provenance": "own work | co-presenter, permission granted" }
   ```

   `id`, `src`, `alt`, `credit`, and `provenance` are required. Subjects are
   non-human by Glenn's choice — this panel is for photos, so it holds to
   that rule strictly, unlike clip art above.
3. Run `node js/photos.test.js` — it checks every entry has the required
   fields, unique ids, an image file that exists, and (for now) that every
   entry is credited to Adam Goldman under "co-presenter, permission
   granted." Loosen those last two checks if a second photographer's work
   is added later.

## Autosave and shared machines

The zine autosaves in the browser (IndexedDB) shortly after each change and
comes back on reload. Only the zine is autosaved — pages, format, current page,
title/author — not Word Bank additions; use **Save Project** for a full copy.

On shared workshop computers, press **New** between participants: it clears the
canvas *and* deletes that browser's autosave, so the next person doesn't open
the previous person's zine.

## Running locally

No build step. Serve the folder with any static file server (needed for the
`fetch()` calls that load the JSON data files — opening `index.html`
directly via `file://` will not load the grammar or gallery):

```bash
python3 -m http.server
```

Then open `http://localhost:8000/`.

## File layout

See `docs/superpowers/specs/2026-08-27-zineworkshop-design.md` for the full
design rationale. Summary:

- `js/store.js` — shared state + save/load
- `js/tracery.js` — grammar expansion engine
- `js/editor.js` — canvas (ported from `tools/ziner/`)
- `js/export.js` — PDF export + JSON save/load wiring
- `js/autosave.js` — browser autosave + "New" reset
- `js/generator.js` — poetry generator panel
- `js/gallery.js` — curated flyer gallery panel
- `js/clipart.js` — clip art (pre-cut collage pieces) panel
- `js/photos.js` — curated photos panel
