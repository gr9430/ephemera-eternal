# Auto-collation (half-letter) and sheet rotation (single-page) — design

Date: 2026-09-30

## Intent

Workshop participants make zines in two ways, and each needs one missing piece
before the printout is usable:

- **Half-letter** zines are booklets built one 5.5" × 8.5" page at a time, in
  reading order. The printout must be **auto-collated**: a cover sheet plus
  inside pages imposed two-up on letter sheets in booklet order, so the
  printed stack folds and staples into a zine that reads in order. A booklet
  is usually one person's, but pages from several people's saved projects can
  be combined into a group zine. Half-letter does not need rotation.
- **Single-page** zines (folded and stapled formats) are built directly on the
  11" × 8.5" imposed sheet. The top row of panels is upside down, so the
  participant needs to **rotate the sheet view while working**. The sheet
  already is the printout, so it is not collated.

Success: a half-letter booklet exports to a PDF that, printed either
double-sided or in two single-sided passes, folds into a correctly ordered
booklet with covers, the participant's info page and Glenn's info page; the
Preview shows that order before printing; and single-page work can be done in
any of the four 90° orientations without affecting the printed sheet.

Context: the zoom-dependent page size bug (the page's flex item shrank
vertically when the viewport was short) was fixed separately in
`css/editor.css` before this design and is not part of it.

## Scope

In:
1. Half-letter booklet structure: covers, participant info page, Glenn's info
   page, 1–24 inside pages.
2. Booklet imposition and PDF export (double-sided and two-pass). Fixes the
   current bug where half-letter export only outputs the page on screen.
3. Participant info form.
4. Importing inside pages from other saved projects (group zines).
5. Booklet-order view in the Preview modal.
6. 90°-step view rotation for single-page and stapled formats.

Deferred (agreed to revisit after the above ships):
7. **Stapled format layout.** The current stapled panel labels
   (`js/editor.js` `renderPanelGuides`) cover 16 panels but omit pages 6 and
   15. Glenn will supply the correct order per side in `N | N` grid form, plus
   how the sheet is folded/cut. The guides, labels and any preview for stapled
   will be updated then. The folded single-page order (top upside-down:
   5 | 6 | Back cover | Front cover; bottom: 4 | 3 | 2 | 1) stays as is.

Not in: a separate cover-sheet PDF (e.g. for cardstock); the cover sheet
prints in the same PDF as the inside pages.

## 1. Half-letter booklet structure

Each half-letter page in `state.pages` gets a `role`:
`'front-cover' | 'their-info' | 'inside' | 'back-cover'`.

- Editor tab order: `Front cover | Your info | 1 | 2 | … | Back cover`.
  Inside pages are numbered 1–N in tab labels.
- New half-letter project: front cover, Your info, one inside page, back
  cover.
- "Add page" inserts an inside page after the current inside page (or after
  the last inside page when a non-inside tab is active). Disabled at 24
  inside pages.
- "Remove page" works on inside pages only, and never removes the last
  inside page. Covers and their-info cannot be removed.
- Glenn's info page is not in `state.pages` and has no tab; it is rendered
  from `data/organizer.json` (section 3) wherever it appears.
- Migration (on autosave restore and JSON import): a half-letter project whose
  pages have no `role` keeps all its pages as inside pages (first 24; any
  beyond are dropped with a one-line notice), and gets blank front cover,
  their-info and back cover pages added. Single-page and stapled projects
  are untouched.
- Switching format to half-letter creates the structure above (same as
  today's format switch, which already resets pages).

## 2. Imposition and PDF export

New pure function in `js/booklet.js` (with the other pure booklet logic, so it is Node-testable; `js/export.js` uses it):

```js
bookletSheets(insideCount) -> [{ front: [left, right], back: [left, right] }, ...]
```

Slot values are `'front-cover' | 'back-cover' | 'their-info' | 'glenn-info'`,
a 0-based inside-page index, or `null` (blank).

- Sheet 1 (cover sheet), always present:
  - front: `['back-cover', 'front-cover']`
  - back: `['their-info', 'glenn-info']`
- Inside sheets: `N` = `insideCount` rounded up to a multiple of 4
  (4, 8, 12, 16, 20 or 24; `insideCount` is 1–24). Indexes `insideCount ..
  N-1` are `null`, so padding blanks follow the last inside page. For inside
  sheet `s` (0-based, `s < N/4`):
  - front: left = `N-1-2s`, right = `2s`
  - back: left = `2s+1`, right = `N-2-2s`

This reproduces Glenn's order tables. Example, 24 inside pages (1-based):

| Sheet | Front (left \| right) | Back (left \| right) |
|---|---|---|
| 1 | Back cover \| Front cover | Your info \| Glenn's info |
| 2 | 24 \| 1 | 2 \| 23 |
| 3 | 22 \| 3 | 4 \| 21 |
| 4 | 20 \| 5 | 6 \| 19 |
| 5 | 18 \| 7 | 8 \| 17 |
| 6 | 16 \| 9 | 10 \| 15 |
| 7 | 14 \| 11 | 12 \| 13 |

Example, 8 inside pages: sheet 2 = 8 | 1 / 2 | 7, sheet 3 = 6 | 3 / 4 | 5.
With 6 inside pages: pages 7 and 8 are blank.

`generatePDF()` half-letter branch:

- "Save as PDF" opens a small choice dialog (styled like the existing preview
  modal) with two buttons and a cancel:
  - **Double-sided booklet** — PDF pages: sheet 1 front, sheet 1 back,
    sheet 2 front, … Dialog note: "Print double-sided, flip on short edge."
  - **No duplex printer** — all fronts in sheet order, then all backs in
    sheet order. Dialog note: "Print the first half, put the printed stack
    back in the tray, then print the second half. Try with one sheet first —
    printers differ in how the stack goes back in."
- Each PDF page is 11" × 8.5" landscape (792 × 612 pt). Each slot is a
  528 × 816 capture placed at x = 0 or 396 pt, full height:
  - editor pages (covers, their-info, inside): switch `state.currentPage`,
    `renderCanvas()`, wait, capture `.canvas-container` with html2canvas at
    the existing settings. Captures are cached per page so each is captured
    once.
  - Glenn's info: render the organizer page (section 3) into an offscreen
    528 × 816 element and capture it.
  - `null`: fill with the paper colour `#f8f8f0`.
- Guides hidden, selection cleared and current page restored before/after, as
  today. Filename: `zine-booklet-<duplex|two-pass>-<date>.pdf`.

## 3. Glenn's info page (`data/organizer.json`)

```json
{
  "name": "Glenn …",
  "role": "workshop line, e.g. who runs it and where",
  "lines": ["a few lines of text"],
  "links": ["https://…"],
  "image": "images/organizer/logo.png"
}
```

All fields optional except `name`. Loaded at startup alongside the other
`data/*.json` files into `state.organizer`. `buildOrganizerPage(organizer)`
returns a 528 × 816 element: optional image at top, then name, role, lines
and links, centred, in the app's default font, inside the 24 px margin.
Participants cannot edit it; it appears in the Preview booklet view and the
PDF only. A missing or invalid file renders a page reading "Organizer info
not set" rather than failing the export. Glenn fills in the real content.

## 4. Participant info form

On the their-info tab (labelled "Your info"), the right panel shows an **Info form**: Name, Contact,
Date (defaults to today), Note (multi-line). "Fill in page" creates text
elements laid out top-down inside the margins, each tagged
`fromInfoForm: true` and each in a random font from the editor's font list
(re-drawn on every fill). Filling in again removes only tagged elements and
recreates them; untagged elements the participant added stay. After filling
in, the elements are ordinary text elements: movable and restylable. Form
values are stored in `state.meta.info` so they survive autosave and JSON
save/load.

## 5. Import pages (group zines)

"Import pages…" button (half-letter only) next to Save/Load JSON. Accepts one
or more project JSON files.

- From each file, take its inside pages: pages with `role: 'inside'`, or all
  pages for a half-letter project without roles. Single-page and stapled
  projects are skipped with a notice.
- Append them after the current last inside page, in file then page order.
- Regenerate every element `id` (`generateId()`) to avoid collisions.
- Stop at 24 inside pages; report "Imported X pages, skipped Y (24-page
  limit)".
- Covers, their-info and form values of imported files are ignored.

## 6. Preview modal: booklet view

For half-letter, the Preview modal gets a two-button toggle at the top:
**Reading order** (default) | **Booklet sheets**.

- Refactor the per-page DOM builder inside `openDigitalPreview()` into
  `buildPreviewPage(page)` returning a 528 × 816 `.preview-page` element, so
  both views share it.
- Reading order: front cover, Your info, inside 1–N, back cover, each
  captioned with its role or number. (Glenn's info is shown after Your info,
  captioned "Glenn's info".)
- Booklet sheets: for each entry of `bookletSheets`, two spreads ("Sheet 1 —
  front", "Sheet 1 — back"), each a 1056 × 816 row of two pages (blank slots:
  an empty page captioned "blank"). Each half captioned with its role or
  1-based page number. Spreads are scaled with CSS `zoom` to fit the modal
  width (unlike `transform: scale()`, it also shrinks the layout box).
- Other formats: Preview unchanged.

## 7. Single-page / stapled view rotation

- `state.viewRotation`: 0 | 90 | 180 | 270. View-only: not written by
  `exportProjectJSON`, not autosaved, reset to 0 on format change and on load.
- Toolbar: two buttons, "⟲ Rotate left" and "⟳ Rotate right", shown only for
  `single-page` and `stapled`. Current angle shown on the buttons' tooltip.
- Rendering: `.canvas-container` gets `transform: rotate(<deg>)`; a new
  wrapper `.canvas-rotator` around it is sized to the rotated bounding box
  (816 × 1056 at 90/270, 1056 × 816 at 0/180) so the canvas area centres and
  scrolls correctly. Panel labels need no change; at 180° the upside-down
  labels read upright.
- Pointer mapping: a pure helper in `js/store.js`,
  `screenToSheet(dx, dy, rotation, sheetW, sheetH) -> { x, y }`, maps a
  screen-space offset from the centre of the sheet's on-screen box (which does
  not move when the sheet turns) into unrotated sheet coordinates. Every
  place that turns `clientX/clientY` into canvas coordinates (drag start/move
  near `js/editor.js:1041`, resize near `:1190`, drops from the Clip Art /
  Gallery / Photos panels, click-to-add) uses a single
  `clientToSheet(clientX, clientY)` built on it, instead of subtracting
  `getBoundingClientRect().left/top`. Resize deltas and Alt-drag/handle element
  rotation are computed from mapped sheet coordinates, so they need no extra
  angle offset. Click-to-place from the side panels uses fixed sheet
  coordinates and needs no mapping.
- Export: `generatePDF()` sets `viewRotation` to 0 before capture and restores
  it after, so the PDF is identical at every angle.

## Error handling

- Export failures keep today's behaviour (console error, alert, UI restored),
  and additionally restore `viewRotation` and `currentPage`.
- Cancelling the export choice dialog leaves state untouched.
- Import: unreadable or non-project files are skipped and named in the
  result notice; nothing is imported from a file that fails to parse.

## Testing

- `js/export.test.js` (Node, same inline-copy style as `store.test.js`):
  `bookletSheets` for 1, 4, 5, 6, 8, 12, 16, 20, 24 inside pages — cover
  sheet always first and as specified; every inside index `< insideCount`
  appears exactly once; blanks fill the rest; inside sheet count is `N/4`;
  the 24-, 20-, 16-, 12-, 8- and 4-page tables match Glenn's.
- `js/rotation.test.js` (loads the real `store.js`): `screenToSheet` at 0/90/180/270 for known points. `js/booklet.test.js` also covers half-letter migration
  (no roles → inside pages + covers, >24 truncated) and import id regeneration
  and the 24-page cap; `js/autosave.test.js` covers migration on restore.
- Headless Chromium (Playwright, local static server):
  - Half-letter, 5 inside pages with distinct text, plus text on covers and
    their-info: export both modes; check PDF page count (6 sides: cover sheet
    + 2 inside sheets), page size 792 × 612, and (via rendered page images)
    which content lands in each half, including Glenn's info.
  - Info form: fill in, edit one element, fill in again — form elements
    replaced, extra element kept.
  - Import two saved projects; page count and cap behave as specified.
  - Preview booklet view shows the expected sheets and captions.
  - Single-page at each rotation: drag an element right/down on screen and
    check it moves right/down on screen; export at 90° matches export at 0°.
