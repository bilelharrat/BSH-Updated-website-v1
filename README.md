# Berkeley Summit House: website redesign

A working, seven-page redesign of berkeleysummithouse.org, built around one
idea: **the summit**. The house sits in the Berkeley Hills, so the site is
drawn like a topographic map of them. Plain HTML, CSS and a little
JavaScript, with no build step.

Earlier concepts are kept in git history: the serif "house on the hill"
at `c729efd`, and the Apple-style version at `5e4a5d4`.

## View it

From this folder, serve it and open http://localhost:8041:

```sh
python3 -m http.server 8041
```

Everything, photos included, is in this folder; only the fonts load from
Google Fonts.

## The idea

- **Three doors.** The home page hero sets the pitch beside three doors,
  one per pillar (Ventures, the Incubator, the Foundation), each edged in its
  pillar's color. Our Story and Events sit on the line below them.
- **Terrain.** Generated contour lines run behind the page heroes, the pillar
  cards, the Incubator's focus areas and the footer. Every fifth line is
  heavier, the way index contours are on a real map.
- **Color is wayfinding.** Each pillar owns one color everywhere it
  appears: in the nav, on the home page doors, in labels, on its page, and
  on the join form's role cards. The three colors come from the house photo: the
  Berkeley sky (cobalt, Ventures), the tile roof (poppy, Incubator) and the
  summer hills (gold, Foundation). Everything else is white, stone and ink.
- **Find your way in.** A picker on the home page asks who you are
  (founder, investor, operator, researcher, scout, aged 15 to 35, or just
  curious) and lays out a short trail of where to start, ending with the right
  join link.

## Design language

| | |
| --- | --- |
| Display type | Funnel Display, set large and tight |
| Text | Funnel Sans, 17px |
| Details | Geist Mono for labels, dates, places and coordinates, led by the ▲ summit mark |
| Colors | Ink `#131417`, white, stone `#F1F1EE`, night `#111316`; cobalt `#2743D6`, poppy `#E85A2E`, gold `#EDB431` |
| Surfaces | "Fields" (`.f-paper`, `.f-stone`, `.f-night`, `.f-cobalt`, `.f-poppy`, `.f-gold`) set the colors for everything placed on them |
| Shape | 6px controls, 14px cards, full-bleed color heroes |
| Motion | The map drifts at 30fps only while it is on screen and holds still under Reduce Motion. Content below the fold eases up once; nothing starts hidden. |

## Pages

| Page | What's on it |
| --- | --- |
| `index.html` | The pitch and three doors, one per pillar; the three pillars; the story in short; "Find your way in"; a strip of photos from gatherings |
| `story.html` | The origin story in four chapters, with a rail that follows your reading; "born in 2024"; a timeline that climbs; mission; values |
| `ventures.html` | Thesis, two ways we invest, key figures, portfolio, GP partners, what we look for |
| `incubator.html` | The four focus areas as an accordion, each with its own terrain; how we work |
| `foundation.html` | Ages 15 to 35 on a ruler; the four programs with photos from past gatherings |
| `events.html` | Upcoming (Luma), a logbook of past gatherings with a year filter and photo previews, albums with a photo viewer |
| `join.html` | Choose your role (pre-selected from links like `join.html#investor`), your details, and what happens next |

| File | What it holds |
| --- | --- |
| `assets/style.css` | Tokens, fields and all styles |
| `assets/terrain.js` | The contour-map renderer (seeded simplex noise and marching squares, on canvas) |
| `assets/chrome.js` | Header, mobile menu, footer and icons, as custom elements |
| `assets/app.js` | Header behaviour, the way-in picker, photo strip, story rail and timeline, events filter and previews, photo viewer, join form |
| `assets/photos/` | Self-hosted WebP photos at several widths, picked by each image's `srcset` and `sizes` |

## Photos

Photos are self-hosted in `assets/photos/` as WebP, named
`<album>-<n>-<width>.webp`. Widths are 480, 800, 1200, 1600 and 2000px;
photos are never upscaled, and the house photo tops out at 1024. Metadata
and colour profiles are stripped (the originals were all sRGB).

- Each `<img>` has a `srcset`, a `sizes` and `width`/`height`. `sizes` is the
  width the whole photo is drawn at once `object-fit: cover` fills its
  frame, so a wide photo in a tall frame asks for more pixels.
- The album viewer shows the 1600w files and fetches the next and previous
  photo ahead. The logbook thumbnails share the 480w file with the pointer
  peek, so the peek appears straight from the cache.
- To add a photo, export it at those widths (WebP, quality about 80) and
  give it the same markup as the photos beside it. `tests/photos.spec.cjs`
  fails on a photo that is hotlinked, missing or has no `width`/`height`.

## The join form

Out of the box the form is a design prototype. It checks what people type,
thanks them by name and role, and sends nothing; two small "Design
prototype" notes say so.

To make it live, set one attribute on the form in `join.html`:

```html
<form class="join-main" id="join-form" data-endpoint="https://formspree.io/f/your-form-id" novalidate …>
```

From then on both prototype notes are hidden, and a valid submit POSTs the
form as `multipart/form-data` with `Accept: application/json`:

| Field | Value |
| --- | --- |
| `role` | `founder`, `cxo`, `investor`, `scout`, `scholar` or `young-leader` |
| `first-name`, `last-name`, `organization`, `email`, `phone`, `linkedin` | As typed |
| `phone-country` | Dial code and country, for example `1\|United States` |
| `note` | As typed; may be empty |
| `_gotcha` | Spam trap; always empty when a person fills in the form |

- **Replies.** Any 2xx reply shows the thank-you, worded from what was sent.
  A non-2xx reply, a network error, or no reply within 15 seconds keeps the
  form and everything typed, says "We couldn't send your details. Check your
  connection and try again, or email founders@berkeleysummithouse.org." and
  lets the person try again. While sending, the button reads "Sending…" at
  its usual width and further submits are ignored.
- **The endpoint must allow the site's origin.** It has to reply with an
  `Access-Control-Allow-Origin` header that covers the site, and answer with
  JSON rather than a redirect: a reply the browser can't read counts as a
  failure, and the person is asked to try again (the endpoint may still
  have received it). No preflight is sent, so no OPTIONS handler is needed.
  Formspree and similar form services meet all of this.
- **Spam.** `_gotcha` is hidden from people, screen readers and the Tab key.
  If it is filled, the page shows the thank-you and sends nothing. Bots that
  post straight to the endpoint never load the page, so the endpoint should
  also discard any submission with `_gotcha` filled; Formspree does this for
  that field name on its own.

## Tests

Browser tests (Playwright, Chromium) pin down every page's behaviour,
content and look. From this folder:

```sh
npm i && npx playwright install chromium   # once
npm test                # behaviour and content: every spec except the visual one
npm run test:visual     # full-page pixels at 390, 820, 1280 and 1920 wide, plus interactive states
npm run baseline        # re-take the visual and content baselines; only from a known-good commit
npm run metrics -- <label> [--compare <other-label>]   # file sizes, load and scroll cost, layout shift
```

- Baselines live in `tests/.snapshots` and run output in `tests/.artifacts`;
  both are local and gitignored, so take baselines once (`npm run baseline`)
  on a commit you trust before changing anything.
- Tests run hermetically: photos are a neutral stand-in, web fonts are
  blocked and off-site requests get an empty answer, so the pictures depend
  only on this code. A page error, a console error or a failed request to
  the site fails the test. The visual project runs with reduced motion.
- The live join form is covered by `tests/join-endpoint.spec.cjs`, the
  photos and the album viewer by `tests/photos.spec.cjs`.

## Before launch: things to confirm

1. **New copy.** The headlines are new ("Where dreamers come to build.",
   "One house. Three ways up.", "Bring the idea. We'll bring the house.",
   "Pull up a chair."), and so are the way-in trails, the timeline lines,
   "How we work" and "What we look for". Descriptions of the pillars, areas,
   programs and values are the current site's own words.
2. **Logos.** Portfolio companies and GP partners are listed by name. Add
   real logos if wanted. The current Ventures page also has two logos with no
   names (`portfolio-logo-3`, `portfolio-logo-5`) that need adding.
3. **Connect the join form.** Set `data-endpoint` on the form to the
   submission endpoint; see "The join form". The optional "What are you
   building?" field is new.
4. **Events were copied from Luma by hand** on 2026-09-24. In production,
   pull them from Luma or update the list after each event.
5. **The terrain is stylised.** It is generated, not surveyed. The
   coordinates in the footer are central Berkeley's, not the house's.

## Porting to the production (Next.js) site

- `chrome.js` becomes `<SiteHeader />`, `<SiteFooter />` and `<Icon />`.
- `terrain.js` becomes one `<Terrain seed peaks animate />` client component
  that owns a canvas.
- The tokens and fields at the top of `style.css` move into CSS variables or
  a Tailwind theme. Each block in `app.js` is self-contained and becomes one
  small client component.
