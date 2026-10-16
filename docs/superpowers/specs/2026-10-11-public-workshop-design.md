# Public workshop version — design

Date: 2026-10-11

## Intent

After the show, anyone can make a zine at home from a shared link, with no
facilitator and no shared computers. The plain URL
(`https://glennritchey.net/ephemera-eternal/`) becomes that public version.
The in-person workshop keeps everything it has today behind `?workshop`.

The public version adds what a facilitator used to supply: a welcome that
explains the project and the steps, a way for people to send Glenn the
words they offer the algorithm, and printing and folding instructions after
the PDF saves.

Separately, workshop computers running a small local server keep consented
words in their own file, `data/consented-words.json`, where Glenn reviews
them between sessions and copies approved lines into the grammar by hand.

Success:
- A stranger opening the plain URL understands what to do, builds a zine,
  is offered a way to send their consented words, and can print and fold
  it correctly at home.
- At the workshop, a participant's **Yes** lands in
  `data/consented-words.json` immediately, with no download, and Glenn
  reviews it there.

## Decisions (from Glenn)

- The public version is for **people at home after the show**.
- **Public is the default**: the plain URL is public. Workshop computers
  open `?workshop`.
- `?opening-night` and `?organizer` are **workshop-only**: they work only
  together with `?workshop`.
- Public words are **batched and offered at Save as PDF**: download a
  `.txt`, open an email draft, or not now.
- The destination email address **doesn't exist yet**. It lives in
  `data/public.json`. While it's empty, the send step is skipped.
- Welcome is a **first-visit overlay** with a **How to** button to reopen it.
- Print help is a **dialog after the PDF saves**. Double-sided steps must
  say **flip on short edge**.
- Workshop words go **into a separate file, `data/consented-words.json`,
  on Yes** (revised 2026-10-15; the first version wrote into
  `data/grammar.json`). Glenn approves them between sessions and copies
  approved lines into the grammar by hand, so the addendum's "evaluated
  for sensitivity before use" stays true. The file is git-ignored, so
  participants' words are never published with the site.

## Mode (`js/mode.js`)

Reads `location.search` once:

```js
const Mode = { workshop: params.has('workshop') };
```

- `openingnight.js`: `active` is `Mode.workshop && has('opening-night')`.
- `wordreview.js`: `active` is `Mode.workshop && has('organizer')`.
- `welcome.js`, `wordssend.js`, `printhelp.js` run only when
  `!Mode.workshop`.
- A pure `readMode(search)` returns `{ workshop, openingNight, organizer }`
  for the Node test. The modules above use it instead of reading the URL
  themselves.

`?workshop` is checked on its own: `?workshop&opening-night` and
`?workshop&organizer` both work, and a bare `?opening-night` or
`?organizer` on the public URL does nothing.

Rollout: workshop machines bookmarked to the plain URL switch to public
behavior when this ships. The README tells Glenn to update bookmarks to
`?workshop` (and `?workshop&opening-night`) before the next workshop.

## Config (`data/public.json`)

```json
{
  "wordsEmail": "",
  "welcome": {
    "heading": "Make a zine with Ephemera Eternal",
    "paragraphs": ["…"],
    "steps": ["…"]
  },
  "printHelp": {
    "duplex": ["…"],
    "two-pass": ["…"],
    "sheet": ["…"],
    "poster": ["…"]
  }
}
```

I draft the starter wording, and Glenn edits it. A missing or unreadable
file disables the public-only features: no welcome, no send step, no print
dialog. The editor itself still works.

## Public: sending words (`js/wordssend.js`)

### Storage

The words stay in the existing `WordStore` (IndexedDB
`zine-workshop-words`). The entry statuses become `pending`, `approved`
(organizer flow, unchanged) and `sent`. A `sent` entry carries a `sentAt`
time. Public mode never writes `approved`, and workshop mode never writes
`sent`.

### Flow

In `generatePDF()`, before `chooseBookletMode()`:

```js
if (!Mode.workshop) await WordsSend.offer();
```

`offer()` resolves immediately unless `wordsEmail` is set **and** at least
one entry is `pending`. Otherwise it shows a modal:

> **You offered N words or lines to the algorithm. Send them to Glenn?**
> (scrollable list of the pending words)
> [Download words (.txt)] [Open email] [Not now]

- **Download words (.txt)** saves `my-words-YYYY-MM-DD.txt`. The modal
  then reads "Attach this file to an email to `<address>`" with a
  **Continue** button.
- **Open email** goes to the `mailto:` link (subject "Words for Ephemera
  Eternal", body is the same text as the file). If that link would be
  longer than 1,800 characters, the button is replaced by "Too many words
  for an email link. Download the file and attach it."
- Either action marks every listed entry `sent`, then the PDF continues.
- **Not now**, Escape, or a click on the backdrop continue to the PDF,
  and the entries stay `pending`.

"Sent" means the words were handed to the person. The page can't tell
whether they actually sent them.

### Pure helpers (in `wordstore.js`, Node-tested)

- `markWordSent(entry, now)`: copy with `status: 'sent'`, `sentAt`.
- `wordsTextFile(entries, now)`: a header ("Words offered to Ephemera
  Eternal, YYYY-MM-DD") then one entry per line.
- `wordsTextFileName(now)`: `my-words-YYYY-MM-DD.txt`.
- `wordsMailto(address, entries, now)`: the `mailto:` URL, or `null` when
  it's longer than 1,800 characters.

## Public: welcome (`js/welcome.js`)

- A modal over the editor on first visit, with the heading, paragraphs,
  numbered steps, and a **Start** button.
- Dismissal is stored in `localStorage` as `ee-welcome-seen`, with reads
  and writes in try/catch. If storage fails, the welcome just shows again
  next visit. It's separate from the autosave, and **New** doesn't reset it.
- A **How to** button in the top bar reopens it. It's hidden in workshop
  mode.
- Escape and **Start** close it, and focus returns to the editor.

## Public: print help (`js/printhelp.js`)

After a successful save in `generatePDF()` (not on failure or cancel):

```js
if (!Mode.workshop) PrintHelp.show(kind);
```

`kind` is `'duplex'`, `'two-pass'`, `'poster'` (poster formats) or
`'sheet'` (the other single-page and stapled formats). The **Print &
fold** modal lists `printHelp[kind]` as numbered steps, with a **Done**
button. Starter wording:

- **duplex**: Print double-sided, **flip on short edge**. Print at 100%
  ("actual size"), not "fit to page". Fold the stack in half, nest the
  sheets in order, and staple the spine.
- **two-pass**: Print the first half of the pages. Put the printed stack
  back in the tray (which way depends on your printer, so try one sheet
  first). Print the second half. Then fold and staple as above.
- **sheet**: Print at 100%, then fold or staple as your format needs.
- **poster**: Print at 100% on paper that matches the poster (letter or
  legal).

## Workshop: words server (`serve.py`)

Python 3, standard library only. Run with `python3 serve.py [port]`
(default 8000) in place of `python3 -m http.server`.

- Serves the repo folder as static files, like `http.server`.
- Binds to `127.0.0.1` only.
- API (JSON in and out; the lists are the texts):
  - `GET /api/words`: `{ "pending": [...], "approved": [...] }`.
  - `POST /api/words` `{ "text": "…" }`: appends the trimmed text to
    pending. It rejects empty text and text over 500 characters (400);
    duplicates of a pending or approved line succeed without adding.
  - `POST /api/words/approve`, `/reject`, `/unapprove` `{ "text": "…" }`:
    pending → approved, removed from pending, approved → pending.
  - Only this computer's own pages may use it: a `Host` or `Origin` other
    than `localhost` / `127.0.0.1` is refused (403), and POSTs must be
    `application/json` (415), which other sites can't send without a
    preflight.
- The file is created on the first Yes and never touches
  `data/grammar.json`:

  ```json
  {
    "pending": [{ "text": "as typed", "addedAt": "2026-10-20T14:05:00" }],
    "approved": [{ "text": "…", "addedAt": "…", "approvedAt": "…" }]
  }
  ```

  Text is kept as typed (it's the consent record), so `#` and `[ ]`, which
  Tracery reads as markup, need care when copying into the grammar.
- Each change re-reads the file, so hand edits are kept. A file that can't
  be read is an error (500), never overwritten. Writes go to a temp file
  in `data/` and then `os.replace`, under a lock.

## Workshop: client changes

- `wordentry.js` (workshop mode, after **Yes**): `POST /api/words`. If the
  request fails (no server: `http.server`, or `?workshop` on the live
  site), fall back to `WordStore.add` as today, with the notice "Words
  saved on this computer only." In public mode, **Yes** always uses
  `WordStore.add`.
- `wordreview.js`: on open, try `GET /api/words`. If it succeeds, list
  server pending/approved, and Approve / Reject / Undo call the API.
  **Download approved** and **Clear downloaded** are hidden. If it fails,
  the current IndexedDB review runs unchanged.
- In server mode the review also says how many words this browser holds
  from before (or from a moment the server failed); those are reviewed
  with plain `http.server`.
- Approved lines reach the generator once Glenn copies them into
  `data/grammar.json`; the grammar is fetched with `no-cache`, so a reload
  picks them up.

## Files

New: `js/mode.js`, `js/mode.test.js`, `js/welcome.js`, `js/wordssend.js`,
`js/printhelp.js`, `data/public.json`, `serve.py`, `serve_test.py`,
`tests/browser/public-mode.cjs`.

Changed: `index.html` (scripts, three modals, **How to** button),
`js/export.js` (two hooks in `generatePDF`), `js/wordstore.js` (+ helpers,
tests), `js/wordentry.js`, `js/wordreview.js`, `js/openingnight.js`,
`js/tracery.test.js`, CSS for the new modals (match existing modal styles),
existing `tests/browser/*.cjs` that rely on workshop behavior (add
`?workshop`), `README.md`.

## Testing

- **Node:** `mode.test.js` (flag combinations, including the bare
  `?organizer` / `?opening-night` doing nothing); `wordstore.test.js`
  (`markWordSent`, text file, file name, mailto including the too-long
  case and characters needing encoding).
- **Python:** `serve_test.py` in a temp folder: add, duplicate, empty and
  too-long rejection, approve, reject, unapprove, hand edits kept, an
  unreadable file not overwritten, `grammar.json` untouched, other
  origins / hosts / content types refused, and binding to `127.0.0.1`.
- **Browser** (`tests/browser/public-mode.cjs`):
  - Public: the welcome shows once and **How to** reopens it; with pending
    words and an address, the send step appears before the PDF, Download
    marks the words sent, and it isn't offered again; with no address
    there's no step; the print dialog follows a successful save.
  - Workshop: none of those appear, `?workshop&opening-night` and
    `?workshop&organizer` still work, and a bare `?organizer` does nothing.
- Existing browser checks pass with `?workshop` added where needed.

## Out of scope

- Sending words from the public site without the person's own email
  (no form services, no server on Codeberg).
- Translations and analytics.
- Changes to the poster gallery.
