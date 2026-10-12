# Rules for working on a practice website

This is a small website for a real practice. The person you're working with owns it or looks after it for
a family member. They are not a programmer. Their clients find them through this site, so a wrong phone
number or a broken page costs them real appointments.

## How to work with them

- Say what you're going to change, in plain words, before you change it. Name the page and quote the old and new text.
- Make only the change they asked for. Don't tidy, reword or "improve" anything else on the way.
- No jargon. Say "the About page", not "about.html". Say "saved", not "committed".
- If you aren't sure what they mean, ask one short question. Don't guess at a name, a number, a credential or a price.
- Never write new claims about treatment, results or qualifications. Use their words.

## What you may edit

| Where | What it holds |
|---|---|
| `content/pages/` | One file per page: the words and pictures on it |
| `public/images/` | Photos and icons |
| `site.json` | Site name, menu, page list, old-address redirects, protected facts |

Everything else is off limits: `wrangler.jsonc`, `package.json`, `CLAUDE.md`, `.claude/`, `archive/`, `node_modules/`.
A request that needs any of those is a job for the site's maintainer. This covers a new layout or design, fonts
and colours, forms, the domain, and email. Stop, say so, and offer to write up what's wanted.

`archive/` is the old website, kept as a record. Don't copy text from it: it holds mistakes that were since corrected.

## Protected facts

`site.json` lists facts under `facts`: usually the phone, fax and address. Change one only when the person
asks for that exact change. Then:

1. Read the new value back to them and wait for a yes.
2. Change it in `site.json` and on every page where it appears, including `tel:` links and map addresses.
3. Run `npm run check`, then `npm run guard -- --allow-protected`.

## After every change

Run `npm test`. It builds the site, checks every link and image, and confirms nothing outside the editable
places was touched. If it reports a problem, fix it before showing anything. If you can't, undo your change and say what happened.

## Pages and pictures

- Pages are HTML fragments. Copy the structure of a neighbouring section; don't invent new class names.
- A new page needs a file in `content/pages/`, an entry under `pages` in `site.json` with a one-sentence
  description, and usually a menu entry under `nav`.
- Renaming or removing a page needs a redirect from the old address under `redirects`.
- Photos: JPEG, at most 1400 pixels on the long side, under 500 KB. Give every image `alt` text that says what
  it shows, and `width` and `height` that match the file's real size.

## Showing, saving and undoing

- **Show:** `npm run deploy:preview` puts the change on the private preview address in the site's `CLAUDE.md`. Ask before running it.
- **Save:** when they say it looks right, commit it with a one-line message in plain words, like "Change the fax number on the Contact page".
- **Undo:** `git revert` the commit, run `npm test`, and show the preview again. Never rewrite or delete history.
- **Publish:** you can't put changes on the real site. Tell them it's ready and that the maintainer publishes it.
