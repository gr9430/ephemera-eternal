# Anti-Gentrification Workshop Zine Tool — Design Spec

**Status:** Approved for planning
**Owner:** Glenn S. Ritchey III

## Purpose

A standalone, Jekyll-free fork of `tools/ziner/` for an anti-gentrification
workshop Glenn is running (~1 month out). Participants build a zine on a
canvas exactly like the existing Ziner tool, with two additions available at
any time, not gated into a linear pipeline:

- A **poetry generator panel** (Tracery-style, ported from
  `phd/interdisciplinary-teaching/machine-learning-and-code/slieve-gullion/`)
  that participants can use to generate candidate lines and insert them as
  editable text elements, or ignore entirely and type their own text — which
  the canvas already supports unmodified.
- A **curated image gallery panel** of pre-loaded, permission-cleared
  flyers/photos participants can place on the canvas and reflect on/around.
  No participant image upload in this exercise.

This is one participant-directed tool, not a multi-activity pipeline: the
generator and gallery are optional panels alongside the canvas at all times.

## Location & platform constraint

Originally staged at `/transfer/zineworkshop/` in the portfolio repo; now lives
at the root of the `ephemera-eternal` repo (paths below are relative to that
root). It is destined for Glenn's Codeberg/Forgejo-hosted portfolio, which has
no Jekyll.
The tool must be plain static HTML/CSS/JS: no build step, no Liquid front
matter, no Jekyll includes/layouts. Plain `<script src>` tags only (matching
both Ziner's and slieve-gullion's existing pattern). CDN script tags for
html2canvas/jsPDF (already used by Ziner for print/PDF export) are fine to
keep — they aren't a Jekyll dependency.

## File layout

```
(repo root)
  index.html
  css/
    editor.css        — canvas/toolbar/properties panel (ported from Ziner)
    generator.css      — poetry generator + gallery panel styling
  js/
    store.js            — shared state: meta, grammar, gallery images, pages/elements
    editor.js            — canvas: create/drag/resize/render elements, accessibility checks (ported from Ziner)
    tracery.js           — Tracery expansion engine (near-verbatim port from slieve-gullion)
    generator.js          — grammar-editor UI ("Word Bank") + generate/insert/reroll controls
    gallery.js            — curated image panel: render list, attribution display, place-on-canvas
    export.js              — JSON save/load (new) + print/PDF export (ported from Ziner)
  fonts/                — carried over from tools/ziner/fonts/
  images/               — pre-loaded, permission-cleared flyer/photo assets
  data/
    grammar.json         — seed Tracery grammar (starter content ships with the tool; final vocabulary supplied by Glenn before the workshop)
    gallery.json          — curated image list: { id, src, alt, credit, caption }
```

## Data model

A single `ZineStore` module (adapted from slieve-gullion's `store.js`),
holding:

```js
{
  meta: { title, author },
  grammar: { origin: [...], <symbol>: [...], ... },  // editable at runtime
  images: [ { id, src, alt, credit, caption, provenance } ],  // gallery + any placed-on-canvas copies
  pages: [ { id, elements: [...] } ]  // Ziner's existing element shapes: text/image/texture/background — unchanged
}
```

`grammar` additions made via the in-app Word Bank editor are session-only
(kept in the store, exportable via JSON save) — they are never written back
to `data/grammar.json` on disk.

## Canvas editor

Ziner's existing element create/drag/resize/render/accessibility-check
functions move into `js/editor.js` essentially unchanged, just extracted
from the current single-file monolith. Free-text authoring (double-click any
text element to edit) is already unrestricted in Ziner, so "the option to
fully write one's own text" requires no new code — it's the default
behavior of every text element regardless of whether it originated from a
generated line or an "Add Text" click.

## Poetry generator panel

A dockable panel beside the canvas:

- Pick a grammar symbol (default: `origin`), click **Generate** — runs
  `Tracery.expand` against the current `grammar` in the store and shows the
  resulting line.
- **Insert as text element** — adds the generated line to the current page
  via `editor.js`'s existing `createTextElement`, positioned at a default
  spot, then draggable/editable like any other text element.
- **Reroll** — regenerates without inserting.
- **Word Bank editor** — lists grammar categories/symbols with their current
  option lists; participants can add new words/lines to any category. Changes
  apply immediately to subsequent generations for that session.

## Gallery / reflective panel

Renders `data/gallery.json` as a fixed list of pre-loaded images, each shown
with visible credit/attribution text (artist/source). Clicking an item places
it on the canvas as an image element (reusing Ziner's existing image-element
creation path), the same way Ziner's built-in SVG pattern gallery already
works. No upload control in this panel. Placing a gallery image imposes no
required next step — generation and free typing remain fully optional
alongside it.

## Persistence & export

- **JSON export/import** (new — absent from current Ziner): serializes the
  full store to a downloadable `.json`, and can load one back in, so a
  participant or Glenn can save/resume a session. Modeled on slieve-gullion's
  `ZineStore.exportJSON`/`importFile`.
- **Print/PDF export**: Ziner's existing html2canvas + jsPDF flow, ported
  into `export.js` unchanged.

## Explicitly out of scope for v1

- Participant image upload (gallery is the only image source in this
  exercise).
- The image-reduction/pixel-analysis pipeline from slieve-gullion (k-means
  dominant color, edge detection, connected components) — gallery images are
  shown with attribution only, not analyzed.
- Multi-user or shared/live sessions.
- Any server component — fully static, matching Codeberg/Forgejo static
  hosting.

## Dependencies on Glenn (content, not code)

Before the generator and gallery panels can ship with real content:

1. **`data/grammar.json`** — the actual anti-gentrification vocabulary and
   templates (displacement, rent, memory, place-loss, etc.). The tool ships
   with a small placeholder grammar so it's testable/buildable before this
   is supplied.
2. **`data/gallery.json` + `images/`** — the curated, permission-cleared set
   of flyers/photos with correct credit/attribution text for each. The tool
   ships with 1–2 placeholder images so gallery UI is testable before this
   is supplied.

## Testing notes

- `tracery.js` and any pure-logic pieces of `generator.js`/`gallery.js`
  should get the same kind of unit tests slieve-gullion's `reduction.test.js`
  and `canvas.test.js` use (plain JS, run however the existing test setup for
  those files runs — check `package.json`/test runner before assuming a
  framework).
- Manual verification: build a small zine using only free-typed text, one
  using only generated text, and one mixing generated text + a gallery image,
  then run print/PDF export and JSON export/import on each.
