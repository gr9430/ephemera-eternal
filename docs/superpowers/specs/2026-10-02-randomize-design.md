# Randomize ("forego all creativity") — design

Date: 2026-10-02

## Intent

A one-click way to hand a whole zine to an algorithm. Glenn uses it to make the
"one of one" opening-night zines (whose fixed back cover says the zine is
"computationally generated" from the Orlando Weekly / Orlando Sentinel
vocabulary); workshop participants can use it too. The algorithm fills a
half-letter booklet to the 24-page maximum with random layouts of grammar
lines, clip art and Adam Goldman's photos, and the person edits from there.

Success: from any state, Randomize → Yes gives a booklet of front cover, Your
info, 24 inside pages and back cover, every composed page readable and
printable, every element editable as normal; the IBM dialog then sends the
person to Your info to add their information. Glenn's info page and (in
opening-night mode) the back cover are never touched.

## Decisions (from Glenn)

- Audience: everyone; the button is always visible, in every mode.
- Existing work is **replaced**, not merged.
- Front cover and back cover get random layouts; **Your info is wiped blank**
  (including the info form's saved values) for the person to fill in.
- **Opening-night mode:** the back-cover page is not touched at all — not
  recomposed, not cleared. The fixed opening-night page prints there as before.
- **Glenn's info page** never changes (it is fixed and not editable anyway).
- **Never use flyers** (`data/gallery.json`). Images come only from clip art
  (`data/clipart.json`) and Adam's photos (`data/photos.json`).
- Composition uses a small set of **random layouts**, not free collage.
- **Front cover title is always "Ephemera Eternal"**; the random output is the
  subtitle.

## Flow

1. **Randomize** button in the top toolbar (`#randomize-btn`).
2. Confirm dialog (app modal, same style as the booklet export dialog):
   "are you sure you want to forego all creativity to an algorithm?" with a
   smaller line "Your current zine will be replaced." Buttons **Yes** / **No**.
   No, a click on the backdrop, or Escape closes it and changes nothing.
3. On Yes:
   - If `state.pageFormat` is not `half-letter`, switch to it (the format
     `<select>` follows).
   - Build the new page list (see Composer): front cover, their-info (empty),
     24 inside pages, back cover.
   - In opening-night mode (`OpeningNight.active`), the back-cover page object
     from the current zine is carried over unchanged; if the current zine has
     no back-cover page (single-page format), a blank one is used.
   - Clear `state.meta.info` to `{}` (empty form).
   - `state.currentPage = 0`, clear selection/editing, `render()` (which also
     schedules autosave).
4. Second dialog: shows `images/clipart/ibm.png` with the text
   "this image is correct: insert your information, please." and one **OK**
   button. OK (or backdrop / Escape) closes it and sets the current page to
   the their-info page, where the info form appears.

`ibm.png` is not listed in `data/clipart.json`, so it is never drawn at random.

## Composer

Pure functions in `js/randomize.js`, no DOM, Node-testable like `booklet.js`.

    composeZine({ grammar, clipart, photos, fonts, rng, newId }) → pages

- `grammar`: the Tracery grammar (`state.grammar`); text is expanded with
  `Tracery.expand`.
- `clipart`, `photos`: the panel data lists (`src`, `alt` used).
- `fonts`: `{ readable: [...], display: [...] }` font family names.
  Readable = editor font categories Core, Sans Serif, Serif; display = Display,
  Experimental, Special. (`fontSources` in `js/editor.js` carries the
  categories.)
- `rng`: a `() => number in [0,1)` function. Tests pass a seeded generator so a
  failure can be replayed; the app passes `Math.random`.
- Returns the four-role booklet page list (`front-cover`, `their-info`,
  24 × `inside`, `back-cover`) in the editor's page/element shape; the wiring
  substitutes the back cover in opening-night mode.

### Element shapes

Elements use the editor's existing types and fields (`text`, `image`,
`background`, `background-image`, `texture`), so the editor, preview, PDF,
autosave and Save Project handle them unchanged. Images use `image`
(rendered `object-fit: contain`, so any box keeps the picture's proportions)
except the full-page photo, which uses `background-image` (cover-fit) with
`opacity: 1`. Text is `#1a1a1a`.

### Layouts

Page content stays inside the 48 px margins of the 528 × 816 page (the full-page
photo and grit overlays excepted, as they are meant to bleed).

| Layout | Content |
|---|---|
| Big image | One photo in the top ~two-thirds; one grammar line (`origin`) under it as a caption. |
| Poem | 4–7 `origin` lines stacked down the page at staggered indents, each its own readable font, size (14–22 px) and slight tilt (±4°). |
| Collage | 2–3 clip-art pieces at random sizes (120–260 px box) and tilts (±15°), plus 2–3 `origin` lines placed in the remaining bands. |
| Photo + slogan | One photo as a full-page `background-image`; one `slogan` line in a display font (36–56 px) on a solid paper-colored (`#f8f8f0`) `background` strip with `opacity: 1`, behind the text, so it stays readable. |
| Front cover | "Ephemera Eternal" in a random display font (44–64 px) as the title; a `slogan` or `origin` subtitle in a readable font; one image (photo or clip art). |

- Inside pages and the back cover draw from Big image, Poem, Collage,
  Photo + slogan; the **same layout never appears on two consecutive pages**
  (back cover counts as following page 24).
- The front cover always uses the Front cover layout.
- **No repeated images**: each photo and clip-art piece is used at most once per
  zine; a pool is reshuffled only if it runs out.
- Display fonts appear only in titles and slogans; captions and poem lines use
  readable fonts.
- About 1 composed page in 4 gets one grit overlay (`overlays/grit-1.png` or
  `grit-2.png`) as a `texture` element on top, multiply blend, 30% opacity.

## Files

- `js/randomize.js` (new): composer (pure) and `Randomize` UI wiring
  (`init`, dialogs, apply).
- `js/randomize.test.js` (new): Node tests for the composer.
- `index.html`: Randomize button, the two dialogs, script tag.
- `js/editor.js`: `Randomize.init()` call; expose the readable/display font
  split if `fontSources` is not reachable from `randomize.js`.
- `css/editor.css`: dialog styles (reusing the export dialog's look), IBM image
  sizing.
- `tests/browser/randomize.cjs` (new): browser check.
- `README.md`: short section.

## Testing

Node (`js/randomize.test.js`, seeded rng, several seeds):
- page list is front cover, their-info, 24 inside, back cover;
- their-info is empty;
- no element `src` comes from `data/gallery.json` / `images/flyers/`;
- no photo or clip-art `src` repeats within a zine;
- no two consecutive inside/back-cover pages share a layout;
- every non-bleed element lies within the margins;
- small text (captions, poem lines) uses only readable fonts;
- front cover has a text element "Ephemera Eternal".

Browser (`tests/browser/randomize.cjs`):
- No leaves the zine unchanged;
- Yes from a single-page zine switches to half-letter with 27 pages (front cover, Your info, 24 inside, back cover);
- IBM dialog shows `ibm.png` and its text; OK lands on Your info with the form
  empty;
- in `?opening-night`, a drawing on the back-cover page survives randomizing.

Before calling it done: export a randomized zine to PDF and show Glenn several
rendered pages.

## Out of scope

- Re-rolling a single page.
- Choosing which layouts or sources to use.
- Saving or naming random seeds.
