# Berkeley Summit House: website redesign

A working, seven-page redesign of berkeleysummithouse.org in the language
of Apple's product pages: plain HTML, CSS and a little JavaScript, with no
build step.

The first concept ("the house on the hill", with serif type and hand-drawn
scribbles) is kept in git history at commit `c729efd`.

## View it

From this folder, serve it and open http://localhost:8041:

```sh
python3 -m http.server 8041
```

Opening `index.html` directly also works. Photos and the fallback font load
from the web.

## The design language

- **Type.** The system font: San Francisco on Apple devices, with Inter as the
  fallback everywhere else. Headlines are large, semibold and tightly
  tracked (96 / 80 / 56 / 48px), body text is 17px, and headlines end with a
  period.
- **Color.** White, light gray (`#f5f5f7`) and black sections alternate down
  each page. Text is `#1d1d1f`, secondary text `#6e6e73`, buttons are blue
  (`#0071e3`), links `#0066cc` on light and `#2997ff` on dark.
- **Brand.** BSH's own identity comes through the mountain mark and one
  signature gradient, cyan to mint. The cyan comes from the current site and
  the mint from the physical BSH banner.
- **Components.**
  - A thin frosted navigation bar, plus a sticky page bar on every inner page (title, section links, and a blue pill button).
  - Pill buttons, and "Learn more ›" links.
  - Full-width promo tiles on the home page, and a 2×2 grid of smaller tiles.
  - Rounded "bento" cards with big gradient numbers.
  - Statements that light up word by word as you scroll.
  - An autoplaying photo carousel with a play/pause button and a progress pill.
  - Segmented tabs, a scrolling album shelf, and a full-screen photo viewer.
  - Store-style form fields with floating labels.
  - A small gray footer with breadcrumbs.
- **Motion.** Content is always visible when the page loads. Sections ease up
  as they arrive, hero photos scale forward slightly as you scroll, and
  everything respects Reduce Motion.

Only the style is borrowed. There are no Apple logos, marks or product
references anywhere on the site.

## Pages

| Page | What's on it |
| --- | --- |
| `index.html` | Hero ("Dream. Build. Grow."), tiles for Ventures, Incubator and Foundation, a grid for Our Story, Events, Values and Join, and a carousel of gatherings |
| `story.html` | The origin story, told as statements that light up as you read; "Born in 2024"; a timeline; the mission; the four values |
| `ventures.html` | Thesis, two ways we invest, stats, portfolio, GP collaboration, what we look for |
| `incubator.html` | The four focus areas as app-style icons, then a tab for each area; how we work |
| `foundation.html` | Ages 15–35; the four programs, with photos from past gatherings |
| `events.html` | Upcoming (links to Luma), past gatherings with a year filter, photo albums |
| `join.html` | Choose your network (pre-selected from links like `join.html#investor`), your details, what happens next |

| File | What it holds |
| --- | --- |
| `assets/site.css` | Design tokens and all styles |
| `assets/partials.js` | Navigation bars, footer and icon set (custom elements that map one-to-one onto components) |
| `assets/site.js` | Menus, section highlighting, reveals, scroll-lit text, carousel, tabs, filters, photo viewer, join form |

## Before launch: things to confirm

1. **New copy.** Headlines and subheads were rewritten in a shorter voice
   ("Dream. Build. Grow.", "Backing human-centered AI.", "Four areas. One
   mission."). The origin story was tightened. The Incubator's area headlines
   ("Care, on demand." and so on), "What we look for", "How we work" and the
   timeline lines are new. Descriptions of the pillars, areas, programs and
   values are otherwise the current site's own words.
2. **Logos.** Portfolio companies and GP partners appear as monograms and
   names. Swap in real logos. The current Ventures page also has two logos with
   no names (`portfolio-logo-3`, `portfolio-logo-5`) that need adding.
3. **Photos are hotlinked.** They load from `bsh-static.neuship.co`, and the
   house photo from the current site's image optimizer. Move them into the
   project and resize them before launch; some originals are about 6000px
   wide.
4. **The join form isn't connected.** Wire it to the current submission
   endpoint. The optional "What are you building?" field is new; drop it if
   the backend can't take it.
5. **Events were copied from Luma by hand** on 2026-09-24. In production, pull
   them from Luma or update the list after each event.
6. **San Francisco only renders on Apple devices.** Everyone else sees Inter,
   which is close but not identical. SF can't be embedded as a web font under
   its license.

## Porting to the production (Next.js) site

- `partials.js` becomes `<GlobalNav />`, `<LocalNav />`, `<Footer />` and `<Icon />`.
- The tokens at the top of `site.css` move into CSS variables or a Tailwind theme.
- Each behaviour in `site.js` is self-contained and becomes one small client
  component: the carousel, the scroll-lit text, the tabs, the photo viewer and
  the form.
