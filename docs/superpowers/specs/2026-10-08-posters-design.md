# Posters (letter and legal), zoom, and format-switch confirm — design

Date: 2026-10-08

## Intent

Workshop participants can make a one-sheet, one-sided poster as an alternative
to a zine — either a protest/slogan poster or their own show flyer — and print
it on the workshop printer on the night, which takes both letter and legal
paper. Each poster carries a fixed credit line. Randomize on a poster dumps a
pile of raw material in the middle of the sheet for the participant to arrange
themselves, instead of composing a finished layout.

Two editor changes come with it: zoom (a legal poster is 1344px tall and
otherwise needs scrolling on a laptop), and a confirm before a format switch
wipes the current zine.

Success: a participant picks a poster size, builds a poster (by hand, from
piles, or both), sees the whole sheet without scrolling, and gets a one-page
portrait PDF at the right paper size with the credit line intact and
unclipped when printed.

## Decisions (from Glenn)

- Posters are for **participants**, made and printed at the workshop.
- **Portrait only.** Letter 8.5″ × 11″ and legal 8.5″ × 14″.
- **The workshop printer takes legal**; both sizes are treated the same.
- A **small fixed credit line** along the bottom; not editable.
- **Randomize adds a pile** of materials to the poster (no replacement, no
  warning). The participant arranges it.
- **Two kinds of pile, chosen at Randomize time:** protest and show flyer. The
  poster format itself has no "kind."
- **Zoom** for every format.
- **Confirm before a format switch** clears a zine that has content.

## Formats and page sizes

Two new `#page-format` options:

| value          | label                              | sheet (px, 96/in) | PDF (pt)   |
|----------------|------------------------------------|-------------------|------------|
| `poster-letter`| Poster - Letter (8.5" × 11")       | 816 × 1056        | 612 × 792  |
| `poster-legal` | Poster - Legal (8.5" × 14")        | 816 × 1344        | 612 × 1008 |

One shared size table (`PAGE_SIZES`, keyed by format, `{ w, h }` in px) replaces
the three hard-coded copies: `sheetSize()` and `checkMargins()` in
`js/editor.js`, and the `SHEET_W`/`SHEET_H` use in `js/export.js`'s
single-sheet path. The booklet export keeps its 11 × 8.5 landscape sheet.
The canvas container's width and height come from the table (the existing
per-format CSS classes stay for other styling).

Poster behaviour in the editor:

- One page (`state.pages = [{ id, elements: [] }]`), like `single-page`.
- Add/remove page disabled; Import Pages hidden.
- Rotate buttons shown (already true for every non-booklet format).
- Plain dashed margin guide (as half-letter), with its bottom edge raised to
  the top of the credit strip. No panel guides.

Save, load and autosave need no changes: they already store `pageFormat`.

## Credit line

- Text in `data/poster.json`: `{ "credit": "…" }`. Initial wording:
  *Made at Ephemera Eternal · The AWG Foundation · photographs on loan from
  Adam Goldman*. Loaded at startup the same way as `data/addendum.json`.
- Rendered as a fixed strip inside the poster's `.canvas-container` by the
  canvas render, **not** stored as an element: it can't be selected, moved,
  edited or deleted, and is not in saved projects (like Glenn's info page).
- About 20px tall, small type, centred, sitting **just above** the 24px
  bottom margin (not inside it — most printers can't print the outer ¼″).
- Drawn **above** all participant elements, on a paper-coloured background,
  so it always reads.
- Posters only; shown on screen and captured into the PDF with the sheet.
- If `poster.json` fails to load, the strip is omitted and posters still work.
- **Digital Preview** of a poster shows the whole sheet with the credit
  strip. Preview pages take their size from `PAGE_SIZES` (today every preview
  page is 528×816, which also crops the single-page formats).

## Zoom

- Top-bar controls next to ⟲/⟳: **−**, a percentage readout, **+**, **Fit**.
  Range 25%–200%, steps of 25%.
- **Fit** = the largest zoom at which the (possibly rotated) sheet fits the
  canvas area, capped at 100%.
- Zoom resets to Fit whenever the format changes or a project is loaded
  (file load or autosave restore).
- View-only, like rotation: `state.viewZoom`, never saved, composes with
  `state.viewRotation`. Applied in `applyViewRotation()` (renamed if that
  reads better) by scaling the rotator box and the container.
- Pointer mapping: `clientToSheet()` is the single path from mouse/touch
  positions to sheet coordinates; it divides the screen offsets by the zoom
  before `screenToSheet()`. Drag and resize code is unchanged.
- PDF export sets zoom to 100% alongside rotation 0° before capture and
  restores both afterward, so output is identical at any zoom.

## Format-switch confirm

When `#page-format` changes and any page of the current zine has at least one
element that didn't come from the info form (`fromInfoForm`), ask with `confirm()`: "Switching format clears this zine's pages.
Continue?" Cancel restores the dropdown to the current format and changes
nothing. A zine with no elements switches without asking.

The info form (`state.meta`, including `meta.info`) **carries over** across
every format switch and is never cleared by it; only `state.pages` is
replaced (as today). It doesn't count as content for the confirm. The info
form's text elements on Your info are not re-placed automatically after a
switch back to half-letter; the form still holds the values and **Fill in
page** puts them back.

## Randomize on a poster

- With a poster open, **Randomize** opens a small app modal (same style as the
  booklet export dialog) with **Protest pile**, **Show flyer pile**, **Cancel**.
  No "forego all creativity" confirm, since nothing is replaced. Other formats
  keep today's Randomize behaviour.
- The chosen pile's elements are **appended** to the poster's page; a second
  press adds another pile on top.

### Pile contents (starting counts; constants, easy to tune)

- **Protest:** 1 `slogan` in a display font (large); 2–3 `origin` lines in
  readable fonts; 1–2 photos; 2–3 clip art pieces.
- **Show flyer:** 2–4 `band_name` lines, each its own text element; 1 `venue`;
  1–2 `show_detail` lines (date, doors, price, all ages…); 2–3 clip art
  pieces; no photos.
- Never flyers (`data/gallery.json`).

### Placement

- Each item's centre lands at a random point in the central ~40% of the sheet
  (in both directions), with a random tilt in ±15°.
- Pictures about 200–320px on the long side, aspect ratio kept; text boxes
  about 300px wide, height from `measure` as in `composeZine`.
- Pictures first, text after (text on top).
- Every item is kept inside the margins and above the credit strip
  (`keepInside` with the poster's page box).

### Composer

`composePile({ kind, page, line, clipart, photos, fonts, rng, newId, measure })`
in `js/randomize.js`, pure (no DOM), returning an array of elements.
`page` is `{ w, h, margin }` (margin 48). The credit strip ends 44px from
the bottom edge, so the 48px margin already keeps every item above it. `keepInside` (and `randomText`'s fit check) take the page box as a
parameter instead of reading `RANDOM_PAGE`; `composeZine` passes the booklet
page so booklet output is unchanged.

### Grammar dependency

The show-flyer pile reads grammar symbols `band_name`, `venue` and
`show_detail`. This spec only fixes those names; their content (including
splitting and recombining band and venue names) belongs to the grammar
project. Until they exist: `band_name` falls back to `band`, and any item
whose symbol is missing or expands to nothing is skipped.

## Files

- `index.html` — two format options, zoom controls, poster Randomize modal.
- `css/editor.css` — poster container classes, credit strip, zoom controls.
- `js/editor.js` — `PAGE_SIZES`, poster page setup, guides, credit strip
  render, zoom, `clientToSheet` zoom, format-switch confirm.
- `js/export.js` — portrait poster PDF (`poster-letter-YYYY-MM-DD.pdf`,
  `poster-legal-…`), zoom reset around capture.
- `js/randomize.js` — `composePile`, page-box parameter for `keepInside`,
  poster branch of the Randomize button.
- `data/poster.json` — credit text (new).
- `README.md` — Posters section, zoom, format-switch note.

## Testing

Node (`node js/<name>.test.js`):

- Size table: every format in `#page-format` has a size; poster sizes exact.
- `composePile`, seeded: deterministic for both kinds; every element inside
  the 48px margins (rotated box), so above the credit strip; no flyer sources; all image
  elements before all text elements; missing symbols skipped without error;
  `band_name` falls back to `band`.
- `keepInside` with a passed page box; existing `randomize.test.js` still
  passes unchanged (booklet output identical).

Browser (`tests/browser/*.cjs`, on `harness.cjs`; Playwright must be installed
first — it isn't on the dev machine yet, so none of the browser checks,
existing or new, currently run):

- `poster-export.cjs` — one portrait page, 612×792 (letter) / 612×1008
  (legal); credit text present in the page.
- `zoom.cjs` — drag lands at the right sheet position at 50% and 150%, with
  and without rotation; Fit fits the area and is ≤ 100%; PDF identical at
  different zooms.
- `format-switch.cjs` — confirm shown with content, skipped when empty;
  Cancel leaves zine and dropdown unchanged; info form values survive a
  switch to a poster and back to half-letter.
- All existing browser checks still pass.

Manual, on the workshop printer: print one letter and one legal poster;
the credit line isn't clipped; the print dialog doesn't scale legal onto
letter.

## Out of scope

Landscape posters, multi-page posters, composed (layout-based) poster
Randomize, persisting zoom, pinch-to-zoom, and the grammar content itself
(next project).
