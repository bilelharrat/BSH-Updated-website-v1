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

Photos and fonts load from the web.

## The idea

- **A live map.** The home page opens on a contour map of the hills that
  drifts slowly and rises a little under the pointer. Its peaks are the site
  itself: pins for the House (our story), Ventures, Incubator, Foundation and
  Events each lead to that page. The same terrain, reseeded, runs behind every
  page hero, the pillar cards, the Incubator's focus areas and the footer.
  Every fifth line is heavier, the way index contours are on a real map.
- **Color is wayfinding.** Each pillar owns one color everywhere it
  appears: in the nav, on the map pins, in labels, on its page, and on the
  join form's role cards. The three colors come from the house photo: the
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
| `index.html` | The live map with pins to every section; the three pillars; the story in short; "Find your way in"; a strip of photos from gatherings |
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

## Before launch: things to confirm

1. **New copy.** The headlines are new ("Where dreamers come to build.",
   "One house. Three ways up.", "Bring the idea. We'll bring the house.",
   "Pull up a chair."), and so are the way-in trails, the timeline lines,
   "How we work" and "What we look for". Descriptions of the pillars, areas,
   programs and values are the current site's own words.
2. **Logos.** Portfolio companies and GP partners are listed by name. Add
   real logos if wanted. The current Ventures page also has two logos with no
   names (`portfolio-logo-3`, `portfolio-logo-5`) that need adding.
3. **Photos are hotlinked** from `bsh-static.neuship.co`, and the house
   photo from the current site's image optimizer. Move them into the project
   and resize them before launch; some originals are about 6000px wide.
4. **The join form isn't connected.** Wire it to the current submission
   endpoint. The optional "What are you building?" field is new.
5. **Events were copied from Luma by hand** on 2026-09-24. In production,
   pull them from Luma or update the list after each event.
6. **The map is stylised.** Its terrain is generated, not surveyed, and the
   legend says "Not to scale". The coordinates in the footer are central
   Berkeley's, not the house's.

## Porting to the production (Next.js) site

- `chrome.js` becomes `<SiteHeader />`, `<SiteFooter />` and `<Icon />`.
- `terrain.js` becomes one `<Terrain seed peaks animate />` client component
  that owns a canvas; the pins are ordinary links laid over it.
- The tokens and fields at the top of `style.css` move into CSS variables or
  a Tailwind theme. Each block in `app.js` is self-contained and becomes one
  small client component.
