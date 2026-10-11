# Public workshop version — design

Date: 2026-10-11

## Intent

After the show, anyone can make a zine at home from a shared link, with no
facilitator and no shared computers. The plain URL
(`https://glennritchey.xyz/ephemera-eternal/`) becomes that public version.
The in-person workshop keeps everything it has today behind `?workshop`.

The public version adds what a facilitator used to supply: a welcome that
explains the project and the steps, a way for people to send Glenn the
words they offer the algorithm, and printing and folding instructions after
the PDF saves.

Separately, workshop computers running a small local server write
consented words straight into `data/grammar.json`, held back from the
generator until Glenn approves them between sessions.

Success:
- A stranger opening the plain URL understands what to do, builds a zine,
  is offered a way to send their consented words, and can print and fold
  it correctly at home.
- At the workshop, a participant's **Yes** lands in `data/grammar.json`
  immediately, and approved lines reach the generator after a reload, with
  no download or hand merge.

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
- Workshop words go **into `data/grammar.json` on Yes**, held as pending
  until Glenn approves them between sessions, so the addendum's "evaluated
  for sensitivity before use" stays true.
- Approved lines go into a `participant` symbol referenced **once** from
  `origin`.

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
- API (JSON in and out):
  - `GET /api/words`: `{ "pending": [...], "approved": [...] }`.
  - `POST /api/words` `{ "text": "…" }`: appends the trimmed text to
    `participant_pending`. It rejects empty text, text over 500
    characters, and duplicates of a pending or approved line (reported as
    success; nothing is added).
  - `POST /api/words/approve` `{ "text": "…" }`: moves the line from
    `participant_pending` to `participant`.
  - `POST /api/words/reject` `{ "text": "…" }`: removes the line from
    `participant_pending`.
  - `POST /api/words/unapprove` `{ "text": "…" }`: moves the line from
    `participant` back to `participant_pending`.
- The server creates `participant_pending` and `participant` if missing,
  and adds a single `"#participant#"` to `origin` the first time
  `participant` is non-empty. It never adds a second one, so Glenn can
  repeat it by hand to raise the share.
- Writes go to a temp file in `data/` and then `os.replace`, under a lock,
  so concurrent requests can't interleave.
- Output keeps the file's layout: one symbol per line,
  `"key": ["…", "…"]` compact, a blank line between symbols, 2-space
  indent, non-ASCII kept as-is. The test checks that reading and writing
  the current `grammar.json` with no changes reproduces it byte for byte.
  If it doesn't, the layout rules get fixed before any write is allowed.

### Grammar shape

```json
"origin": [..., "#participant#"],

"participant": ["approved line", "…"],

"participant_pending": ["just offered", "…"],
```

No rule references `participant_pending`, so Tracery never expands it.
`tracery.test.js` gains a check that no rule mentions
`#participant_pending#`.

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
- Approved lines reach the generator and Randomize on the next page load.
  The README says to reload after **New** between participants.

Publishing note for the README: `participant_pending` is in the repo, so
committing before reviewing publishes those lines as unused data. Review
first, then commit.

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
  case and characters needing encoding); `tracery.test.js` (pending is
  unreferenced).
- **Python:** `serve_test.py` with a temp copy of `grammar.json`: add,
  duplicate, empty and too-long rejection, approve, reject, unapprove, a
  single `#participant#` in `origin`, byte-for-byte round-trip, and binding
  to `127.0.0.1`.
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
