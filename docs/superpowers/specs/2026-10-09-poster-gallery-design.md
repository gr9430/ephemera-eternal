# Poster gallery — design

Date: 2026-10-09

## Intent

Glenn's finished posters hang at the show. Visitors scan a QR code on the
wall, which opens a gallery page on their phone. They scroll through the
posters, find one they want, copy its exact title, and tap **Buy**, which
opens the art gallery's storefront. There they enter the title; price and
availability live on the storefront, not here. The same page works online
after the show from a shared link.

Success: on a phone, over venue cell signal, a visitor can go from QR scan
to the storefront with the right title on their clipboard in a few taps,
and can look at any poster full screen in detail first.

## Decisions (from Glenn)

- The posters are **Glenn's own, already made**, displayed at the show. Not
  the workshop participants' posters.
- **Flow:** QR code → gallery → one shared storefront link. Buyers enter the
  poster title at the storefront.
- **One shared store link** for every poster, filled in later by Glenn. The
  page names no payment service.
- **No price, no availability** on the page — the storefront has them.
- Each poster shows **details** and has a **larger view**.
- **Mobile first.** Phones are the primary target (at the show and online);
  desktop is a progressive enhancement.
- **Separate standalone page**, not part of the editor.

## Page and files

- `posters.html` — the gallery page. Standalone: loads only its own CSS and
  JS, none of the editor's scripts or fonts. Not linked from the editor; the
  QR code points straight at it.
- `css/postergallery.css`
- `js/postergallery.js` — fetches the data, renders cards, copy/buy, viewer.
  Data validation is a pure function exported for the Node test.
- `js/postergallery.test.js`
- `data/poster-gallery.json` (the name avoids `data/poster.json`, which holds
  the poster credit line).
- `images/posters/` — poster images.
- `README.md` — a "Poster gallery" section: adding a poster, setting the
  store link, making the QR code from the final URL.

## Data

```json
{
  "storeUrl": "",
  "posters": [
    { "id": "p_example", "title": "Exact Title As Listed In Store",
      "src": "images/posters/example.jpg",
      "alt": "what the poster shows, for screen readers",
      "details": "18×24 screenprint · 2025 · for Band @ Venue" }
  ]
}
```

- `id`, `title`, `src`, `alt` are required. `details` is optional free text;
  when empty or missing, no details line is shown.
- `title` must match the storefront listing exactly; titles are unique.
- `storeUrl` is the one shared link. While it is empty, Buy buttons are not
  shown and the page still works for browsing.
- Posters display in file order.

## Layout (mobile first)

Base styles target a ~360–430px-wide phone in portrait; wider layouts are
added with `min-width` media queries only.

- **Header:** show name and one instruction line: *"Find a poster you like,
  copy its title, then tap Buy and enter the title at the store."*
- **Cards, one per row on phones:** image at full card width (aspect ratio
  kept, no cropping), the **title** large, the details line, then two buttons
  side by side: **Copy title** and **Buy →**.
- Touch targets at least 44px tall; body text at least 16px; no horizontal
  scrolling; respects the safe-area insets on notched phones.
- **Wider screens:** 2 columns from ~700px, 3 from ~1100px. Nothing else
  changes.
- **Performance:** images `loading="lazy"` with `width`/`height` attributes
  (or `aspect-ratio`) so the page doesn't jump while loading; no external
  fonts or libraries.

## Copy title

- Uses `navigator.clipboard.writeText(title)`; the button reads "Copied ✓"
  for ~2s.
- If the clipboard API is unavailable or rejects (e.g. a non-HTTPS page or
  an older in-app browser), the title text is selected instead so the user
  can copy it by hand, and the button reads "Select & copy".

## Buy

- A link (`<a>`, not a script action) to `storeUrl`, opening in a new tab
  (`target="_blank" rel="noopener"`), so the gallery stays open behind it
  for a second poster.

## Larger view

- Tapping a card image opens a full-screen viewer built on a native
  `<dialog>`: the full image fitted to the screen, the title, details, and
  the same Copy title and Buy buttons.
- **Zoom:** native pinch-to-zoom (the page's viewport does not disable user
  scaling). No custom zoom code.
- **Next/previous:** horizontal swipe on the image, plus ‹ › buttons (also
  arrow keys on desktop). No wrap-around past the first or last poster.
- **Close:** ✕ button, Esc, or the phone's back button / back gesture (the
  viewer pushes a history entry when opened; `popstate` closes it).
- Focus moves into the viewer on open and returns to the card's image on
  close.

## Errors

- JSON fails to load or parse: the page shows "Posters couldn't load —
  please refresh."
- An image fails to load: the card stays, showing the alt text in place of
  the image, plus the title and buttons.
- Invalid entries (missing required field) are skipped in the page and
  caught by the test before deploy.

## Testing

Node (`node js/postergallery.test.js`), over the real
`data/poster-gallery.json`:

- every entry has `id`, `title`, `src`, `alt`; ids unique; titles unique
  (case-insensitive, trimmed); each `src` file exists;
- `storeUrl` is a string, empty or an `http(s)` URL;
- validation function: skips invalid entries, keeps valid ones in order.

Manual, in a phone-sized viewport and on a real phone: scroll, Copy title
(check the clipboard), Buy opens the link in a new tab, viewer
open/swipe/pinch/close (including the back gesture), empty `storeUrl` hides
Buy, broken image and failed JSON messages.

## Out of scope

Cart, prices, availability, search or filtering, the QR code image itself
(made with any QR generator from the final URL), and linking the gallery
from the editor.
