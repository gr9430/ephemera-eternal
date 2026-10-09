# Participant words with consent, organizer review, and the addendum page — design

Date: 2026-10-02

## Intent

Participants can add their own words to a zine, and with their consent those words
may later join the vocabulary the algorithm draws from — but only after Glenn has
reviewed them. Participants never see the grammar itself. Every booklet also carries
an addendum explaining where the zine's words come from, that they were evaluated
for sensitivity, and that Glenn cannot take responsibility for every algorithmic
combination.

Success:
- A participant types a word or line, it lands on their page, and they are asked for
  consent; "no" leaves no trace outside their own page.
- Consented words wait, per workshop computer, until Glenn reviews them in a
  passphrase-protected organizer view and downloads the approved ones; nothing a
  participant types reaches the generator or Randomize until merged into
  `data/grammar.json` by hand.
- Every half-letter booklet prints the addendum as the first page inside the cover.
- Randomize fills 23 inside pages so a randomized zine is exactly 7 sheets.

## Decisions (from Glenn)

- The Word Bank becomes only a larger "Add a word or line…" entry box. No category
  dropdown, no word list: "They do not need to see the grammar arrays."
- Consent is asked of the participant, then Glenn approves. The participant's words
  are still theirs to use: Add puts them on their own page regardless.
- Consent text includes: "If you deny consent, your words will not appear again."
- Approval happens after the workshop: export a file, merge later.
- Organizer view behind `?organizer` plus Glenn's passphrase (given in conversation; never written in the repo).
- The addendum is its own page, in every booklet (not single-page formats), placed
  as the first page after opening the cover (facing Your info).
- Randomize fills 23 inside pages; the same logic applies to smaller counts (the
  addendum counts as a page when rounding to whole sheets).

## 1. Word entry and consent (participant)

Replaces the Word Bank section of the generator panel (`index.html`, `js/generator.js`):

- A full-width, 3-row `<textarea id="word-entry">` with placeholder
  "Add a word or line…", and an **Add** button (`#word-entry-add-btn`).
- Removed: `#word-bank-symbol-select`, `#word-bank-list`, `#word-bank-input`,
  `#word-bank-add-btn`, `renderWordBank`, and the session-only `addWordToGrammar`
  path from the UI. The poetry generator (symbol select, Generate, Insert) stays.

On Add (trimmed text non-empty):

1. The text goes onto the current page as an ordinary text element (readable font,
   editable), and the entry box clears.
2. Consent dialog (`#word-consent-modal`, same look as the Randomize dialogs):

   > **May the algorithm reuse your words?**
   > "*the words*"
   > If you agree, your words may appear in other people's zines after the organizer
   > has reviewed them. If you deny consent, your words will not appear again.
   >
   > **I consent** (`#word-consent-yes-btn`) / **I do not consent** (`#word-consent-no-btn`)

3. I consent → the entry is stored as pending: `{ id, text, addedAt }`.
4. I do not consent, Escape, or a backdrop click → nothing is stored.

Storage (`js/wordstore.js`, new): an IndexedDB database separate from the zine
autosave (`zine-workshop-words`, object store `entries`), each entry
`{ id, text, status: 'pending' | 'approved', addedAt, approvedAt? }`. It survives
**New**, reloads and Load Project; `Autosave.startNew` never touches it. If
IndexedDB is unavailable, consent still works but shows "Couldn't save on this
computer; your words stay on your page" and stores nothing.

Nothing in this store is ever read by the generator or Randomize.

## 2. Organizer review (`?organizer` + passphrase)

- With `?organizer` in the address, a **Review words** button appears in the top bar.
  Without it, nothing organizer-related renders.
- Clicking it asks for the passphrase the first time per browser session. The page
  stores only the SHA-256 hex digest of the passphrase (computed with
  `crypto.subtle.digest`), never the phrase. A correct entry is remembered in
  `sessionStorage` until the browser closes. A wrong entry shows "That's not it."
  This deters curious participants; it is not real security (the check runs in the
  page).
- Review panel (`#word-review-modal`):
  - **Pending:** each entry's text and added date/time, with **Approve** / **Reject**.
  - **Approved:** each entry with **Undo** (back to pending).
  - Reject deletes the entry from the store.
  - **Download approved** saves `approved-words-YYYY-MM-DD.json`:
    `{ app: 'zine-workshop', kind: 'approved-words', exportedAt, words: [{ text, addedAt, approvedAt }] }`.
  - **Clear downloaded** (enabled after a download) deletes, after a confirm prompt, only the
    entries that were in that download and are still approved; words approved since stay.
- Merging into `data/grammar.json` is manual, with Glenn: entries become `origin`
  lines by default; placing words in fill-in symbols is decided at merge time.

## 3. Addendum page and page counts

- New fixed slot `'addendum'`, built like Glenn's info page: `buildAddendumPage()` from
  `data/addendum.json` (`{ "heading": "...", "paragraphs": ["..."] }`), same paper,
  readable small type, never in `state.pages`, not editable.
- Imposition (`js/booklet.js` `bookletSheets`): the inside signature is
  `['addendum', inside 0 … inside N-1]`, rounded up to a multiple of 4 with blank
  slots at the end, nested saddle-stitch as today. The cover sheet is unchanged
  (`back-cover | front-cover`, `their-info | glenn-info`), so the addendum is the
  right-hand page facing Your info.
- `slotLabel('addendum')` → "Addendum". Digital Preview shows it in both views
  (reading view: right after Your info). PDF captures it like Glenn's info.
- Page limits:
  - `MAX_INSIDE_PAGES` = 23: + Page, Import Pages and Randomize stop at 23.
  - `MAX_STORED_INSIDE_PAGES` = 24: loading a project or autosave keeps up to 24 inside
    pages (no page that exists today is dropped); more than 24 are dropped with the
    existing notice, now naming 24.
  - 3, 7, 11, 15, 19 or 23 inside pages print with no blanks; 24 prints one extra sheet.
- Randomize fills `MAX_INSIDE_PAGES` (23).

Draft wording for `data/addendum.json` (Glenn to edit):

> **About the words in this zine**
>
> The words in this zine come from an array of sources: a vocabulary drawn from local
> news coverage of gentrification and Uncle Lou's, archival flyers, documentary
> photographs, and lines contributed by workshop participants. They have been
> evaluated for sensitivity before use.
>
> Because these compositions are made by an algorithm, I cannot assume responsibility
> for every combination it produces, and some pages may be upsetting or offensive.
> My efforts behind the scenes are committed to keeping this system from being
> abused, but printed matter made by others may contain upsetting themes or topics.

## Files

- New: `js/wordstore.js` (IndexedDB store), `js/wordentry.js` (entry box + consent),
  `js/wordreview.js` (organizer view, passphrase, export), `js/addendum.js`
  (`buildAddendumPage`), `data/addendum.json`.
- Changed: `index.html`, `css/editor.css` / `css/generator.css`, `js/generator.js`
  (word bank removed), `js/booklet.js` (slot, imposition, limits), `js/export.js`
  (addendum capture), `js/editor.js` (preview, init calls), `js/store.js`,
  `js/autosave.js` (stored-limit wording), `js/randomize.js` (23), README.
- Tests: `js/booklet.test.js` (imposition with addendum, limits, labels),
  `js/wordstore.test.js` (the store's pure part: entry creation, approve/undo, the
  export file shape — kept apart from the IndexedDB calls), browser checks
  `tests/browser/word-consent.cjs`, `tests/browser/word-review.cjs`, plus updates to
  `booklet-export.cjs`, `booklet-preview.cjs`, `booklet-structure.cjs`,
  `randomize.cjs`, `info-and-import.cjs` for the new page and limits.

## Testing

- Node: `bookletSheets` places `'addendum'` as inside slot 0 for 0–24 inside pages;
  3/7/11/15/19/23 inside pages give no blank slots; labels; `MAX_INSIDE_PAGES` 23 and
  migration keeping 24, dropping beyond 24.
- Browser, participant: the entry box has 3 rows and no category select or word list;
  Add puts the text on the page and opens consent; consent stores one pending entry;
  deny / Escape / backdrop store nothing; New leaves the store intact; the generator
  and Randomize never use stored words.
- Browser, organizer: no Review button without `?organizer`; wrong passphrase refused,
  right one accepted and remembered for the session; approve, reject (deleted), undo;
  download contains only approved entries in the documented shape; clear asks first
  and empties approved only; the phrase itself does not appear in any served file.
- Browser, addendum: preview (both views) and PDF place it facing Your info; a
  randomized zine is 7 sheets with no blanks; + Page stops at 23; a 24-page saved
  project loads intact.

## Out of scope

- Syncing words between computers or to a server.
- Automatic merging into `grammar.json`.
- Moderation or filtering of words at entry time (review is Glenn's).
- An addendum on single-page formats.
