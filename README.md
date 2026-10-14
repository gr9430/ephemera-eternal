# Zine Workshop

A standalone, Jekyll-free zine-making tool for an anti-gentrification
workshop, forked from [Ziner](https://github.com/gr9430/ziner). Adds four
optional panels alongside the existing drag-and-drop canvas:

- **Poetry Generator** — a Tracery-style grammar (`data/grammar.json`)
  participants can generate lines from, insert as editable text elements, or
  ignore entirely in favor of typing their own text (already supported by
  every text element). Below it, an **Add a word or line…** box puts the
  participant's words on their page and asks for consent to reuse them (see
  Participant words and review).
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

## Half-letter booklets

A half-letter zine is a booklet: front cover, the participant's info page, the addendum,
1–23 inside pages, and the back cover. "Save as PDF" asks how it will be printed:

- **Double-sided booklet** — print double-sided, flip on short edge.
- **No duplex printer** — the PDF holds all fronts, then all backs. Print the first
  half, put the stack back in the tray, print the second half.

Sheet 1 is the cover sheet (`Back cover | Front cover`, then `Your info | Glenn's info`);
the inside signature starts with the addendum (facing Your info), then the inside pages in
booklet order, padded with blank pages to a multiple of 4 — 3, 7, 11, 15, 19 or 23 inside
pages print with no blanks. Saved projects with 24 inside pages still open whole.
"Import Pages" adds the inside pages from other saved projects, for group zines.

The two single-page formats print the sheet exactly as drawn. **⟲ Rotate left /
⟳ Rotate right** turn the sheet on screen in 90° steps so the upside-down top
row can be worked on right side up; the PDF is the same at every angle.

### Organizer info (`data/organizer.json`)

The inside back cover of every booklet. Participants can't edit it.

    {
      "name": "required",
      "role": "optional line under the name",
      "lines": ["optional lines of text"],
      "links": ["optional links, printed as text"],
      "image": "optional path, e.g. images/organizer/logo.png"
    }

### Opening-night back cover (`data/opening-night.json`)

Open the tool as `http://localhost:8000/?opening-night` for Glenn's opening-night zines. The
top bar shows an **Opening night** label, the front cover becomes the show poster
(`"frontCover"` in `data/opening-night.json`, an image path — 1650 × 2550 px fills the page; other
shapes are fitted whole on white), and the back cover becomes a fixed page of the text in
`"paragraphs"` (one string per paragraph), in the Preview and the PDF. Both cover tabs leave the
editor, so it opens on Your info. Anything already drawn on either cover stays in the project
and comes back when the tool is opened without `?opening-night`. Half-letter only.

### Randomize

**Randomize** in the top bar asks "are you sure you want to forego all creativity to an
algorithm?". Yes replaces the zine with a half-letter booklet of 23 inside pages (24 with the addendum, exactly 7 sheets) plus covers,
each page a random layout (big image, poem, collage, photo + slogan, ransom note, big type,
repetition, two columns, snapshot pile, photo grid, clip-art wallpaper — the two photo-heavy ones
at half odds; several come in flipped or realigned variants) of grammar lines, clip art
and Adam Goldman's photos — never flyers. The front cover is always titled "Ephemera Eternal"
with a random subtitle. Your info starts with a locked note, "I forewent my creativity to an
algorithm and all I got was this zine! Maybe I edited it along the way..." (`RANDOMIZED_NOTE` in
`js/booklet.js`): it can't be retyped, moved or deleted, and the form's Note box is read-only
until **New**. Name, contact and date fill in as usual, and the IBM slide sends the person there.
In `?opening-night` mode both covers are left alone. Everything stays editable.

### Addendum (`data/addendum.json`)

The first page inside every booklet, facing Your info: where the zine's words come from, that
they were evaluated for sensitivity, and the responsibility note. Fixed like Glenn's info page;
edit the wording in `data/addendum.json` (`heading`, `paragraphs`).

### Participant words and review

**Add a word or line…** puts the words on the participant's current page, then asks "May the
algorithm reuse your words?" (denying means the words will not appear again). Consented words are
kept in that browser's storage, apart from the zine (they survive **New**), as *pending*. They never
reach the generator or Randomize on their own.

Open the tool with `?organizer` for a **Review words** button (passphrase required, remembered
until the browser closes; only its SHA-256 hash is in the code). Approve, reject (deletes it) or
undo, then **Download approved** (`approved-words-YYYY-MM-DD.json`) and, once the file is safe,
**Clear downloaded**. Each computer keeps its own list. Approved words are merged into
`data/grammar.json` by hand, as `origin` lines unless placed elsewhere at merge time.

## Posters

**Poster - Letter (8.5" × 11")** and **Poster - Legal (8.5" × 14")** are one portrait sheet, one
side. "Save as PDF" gives one page at that paper size (`poster-letter-YYYY-MM-DD.pdf`,
`poster-legal-…`); print it on matching paper at 100%, not "fit to page".

A credit line runs along the bottom of every poster, just above the margin. Participants can't
edit or cover it. Edit the wording in `data/poster.json` (`credit`); keep it under about 120
characters so it fits on one line.

**Randomize** on a poster asks for a **Protest pile** (slogans, neighborhood lines, photos, clip
art) or a **Show flyer pile** (band names, a venue, show details, clip art) and drops it around
the middle of the sheet, on top of whatever is there. Nothing is replaced; participants arrange,
edit or delete the pieces. The show-flyer pile reads the grammar symbols `band_name`, `venue` and
`show_detail`; until `band_name` exists it uses single `band` words, and a symbol that's missing
is left out.

## Zoom and switching formats

**−**, **+** and **Fit** in the top bar zoom the sheet on screen (25%–200%) in every format. Fit
shows the whole sheet, never above 100%, and is applied whenever the format changes or a project
opens. Zoom is view-only: it isn't saved and doesn't change the PDF.

Changing **Format** clears the zine's pages, so it asks first when they hold anything. The Your
info form keeps its values; **Fill in page** puts them back on the page.

## Poster gallery

`posters/index.html` is a separate, phone-first page for buying Glenn's show posters. It isn't
linked from the editor: make a QR code (any QR generator) from its final URL, e.g.
`https://<site>/posters/`, and put it on the wall. Visitors scroll, tap a poster for a
full-screen view (pinch to zoom, swipe for the next one), copy its title, and tap **Buy**,
which opens the store; they enter the title in "Notes" before checkout. Price and availability live on the store.

1. Put the poster image in `images/posters/` (a phone-friendly size: about 1600px on the long
   side, JPEG or WebP).
2. Add an entry to `data/poster-gallery.json`, in the order you want them shown:

   ```json
   { "id": "p_night_market", "title": "Night Market",
     "src": "images/posters/night-market.jpg",
     "alt": "what the poster shows, for screen readers",
     "details": "18×24 screenprint · 2025 · for Band @ Venue" }
   ```

   `title` must match the store listing exactly — buyers type it in. `details` is optional.
3. Set `"storeUrl"` to the store link (with `https://`). While it's empty, the page shows no
   Buy buttons.
4. Run `node js/postergallery.test.js` — it checks required fields, unique ids and titles,
   that every image exists, and that the store link is a proper URL.

Copy title uses the clipboard, which browsers only allow over HTTPS. Over plain `http://`
(e.g. testing on a phone against `python3 -m http.server`) the button selects the title
instead and reads **Select & copy** — that's expected.

## Browser checks

`tests/browser/*.cjs` drive the real page in headless Chromium with Playwright:

    NODE_PATH=/path/to/node_modules CHROME_PATH=/path/to/chrome node tests/browser/booklet-export.cjs

`NODE_PATH` must contain `playwright`; `CHROME_PATH` is only needed when Playwright's
own browser isn't installed. The page loads html2canvas and jsPDF from cdnjs, so these
need network access.

## Autosave and shared machines

The zine autosaves in the browser (IndexedDB) shortly after each change and
comes back on reload. Only the zine is autosaved — pages, format, current page,
title/author and the info-page form; consented participant words are kept separately (see
Participant words and review). Use **Save Project** for a full copy.

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
- `js/booklet.js` — half-letter booklet structure, page order, page import (pure, Node-tested)
- `js/poster.js` — poster credit line (`data/poster.json`)
- `js/organizer.js` — Glenn's info page from `data/organizer.json`
- `js/addendum.js` — the addendum page from `data/addendum.json`
- `js/wordstore.js` — consented participant words (IndexedDB) + export helpers (pure, Node-tested)
- `js/wordentry.js` — the "Add a word or line…" box and consent dialog
- `js/wordreview.js` — `?organizer` review, passphrase, approved-words download
- `js/openingnight.js` — opening-night mode: poster front cover and fixed back-cover page from `data/opening-night.json`
- `js/randomize.js` — Randomize: random layout composer (pure, Node-tested) and its dialogs
- `js/infoform.js` — participant info-page form
- `posters/index.html`, `js/postergallery.js`, `css/postergallery.css` — public poster gallery (`data/poster-gallery.json`; helpers Node-tested)
- `tests/browser/` — Playwright checks of the real page (see Browser checks)

## Credits

- Forked from [Ziner](https://github.com/gr9430/ziner).
- The poetry generator uses a grammar format adapted from
  [Tracery](https://tracery.io) by Kate Compton.
