# Berkeley Summit House: website redesign

A working, multi-page prototype of a redesigned berkeleysummithouse.org.
Plain HTML, CSS and a little JavaScript, with no build step.

## View it

From this folder, serve it and open http://localhost:8041:

```sh
python3 -m http.server 8041
```

Opening `index.html` directly also works. Fonts and photos load from the web
either way.

## The idea: the house on the hill

The current site leans on a stock photo of a hiker above the clouds. This
design is built from things only BSH has: the white house in the Berkeley Hills,
the founder whose walls were "completely covered with scribbles of ideas", and
real photos of the community. It works in three layers:

1. **An architect's precision.** Crisp editorial layout, with condensed,
   high-contrast serif headlines that echo "Summit" in the logo. The three
   pillars are drawn as floors in a cross-section of the house: Ventures on
   the top floor (with a view of the summit), the Incubator on the main floor
   (the founder's room: mattress, chair, lamp), and the Foundation as the
   foundation. Read bottom-up, it runs from ideation to realized impact.
2. **A founder's hand.** Graphite scribbles and a seafoam highlighter, the mint
   of the physical BSH banner. They're used sparingly. The one big moment is the
   origin story, where the founder's wall draws itself in as you scroll.
3. **Real life.** Photos from real gatherings, and a dated logbook of events
   taken from the Luma calendar.

## What changed, and why

| Current site | Redesign |
| --- | --- |
| The hero is just the logo on a stock photo. The mission appears only after scroll-driven reveals. | The hero says what BSH is and who it's for, has one clear call to action, and shows the house itself. Everything is readable without scrolling to unlock it. |
| Grey text on a blurred photo on every page (low contrast). | High-contrast type on a quiet ground. Day and Night themes, following the system setting by default. |
| The three pillars are three 3D icons. | A drawing of the house explains how the pillars connect. Each pillar page shows "you are here" and has upstairs/downstairs links to the others. |
| A generic "Join Us" form. | "Which room is yours?" on the home page routes each audience (the form's own six networks) to the right pillar. The join form opens with the role already chosen, validates each field inline, and says what happens next. |
| Event photos with repeated titles and no dates. | A dated logbook (2025–2026) plus photo albums with a keyboard-friendly viewer. Upcoming events link to Luma. |
| Ventures shows only logo carousels. | The investment thesis, typeset portfolio and GP lists, what we look for, and separate paths for founders, investors and scouts. |

## Design system

**Color** (Day / Night)

| Token | Day | Night | Use |
| --- | --- | --- | --- |
| `--wall` | `#F3F5F2` | `#0C1513` | page ground (limewash / chalkboard) |
| `--ink` | `#0E1916` | `#E6ECE9` | text, logo, drawings |
| `--ink-2` | `#43504B` | `#AAB6B1` | secondary text |
| `--graphite` | `#6B7571` | `#B6C1BC` | scribbles |
| `--mint` | `#9FE2CF` | `#8FDBC4` | primary buttons, highlighter (BSH banner seafoam) |
| `--bay` | `#1B6453` | `#8FDBC4` | links, focus, "at the house" |

**Type**
- Noto Serif Display, condensed to 72% width: headlines. Italic for the one emphasized word.
- Noto Serif: the origin story, set like a book.
- Hanken Grotesk: body text and interface.
- Nanum Pen Script: handwriting, only in scribbles and notes.

**Layout.** A 12-column grid with a 1320px maximum width and left-aligned, asymmetric
compositions. Thin rules separate sections instead of cards everywhere.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Home: hero, the house and pillars, "Which room is yours?", origin story and the wall, mission and values, gatherings, partners, closing invitation |
| `ventures.html`, `incubator.html`, `foundation.html` | The three pillar pages |
| `events.html` | Logbook, albums, photo viewer |
| `join.html` | Role-first join form |
| `assets/site.css` | Tokens and all styles |
| `assets/partials.js` | Header, footer, logo and the house drawing (custom elements that map one-to-one onto components) |
| `assets/site.js` | Scribble engine and draw-on, pillar highlighting, role picker, photo viewer, join form |

## Before launch: things to confirm

1. **New copy.** Everything not listed here is verbatim from the current site. New lines to review:
   - the hero headline (taken from the origin story) and the hero intro
   - the house caption ("Read it from the ground up…")
   - the six "Which room is yours?" answers
   - on Ventures: "Two ways we invest" and "What we look for"
   - on Incubator: "How we work"
   - on Foundation: which past events are listed under each program
   - the join-role descriptions and the "What happens next" steps
2. **Portfolio names.** The current Ventures page shows two logos with no names (`portfolio-logo-3`, `portfolio-logo-5`). Add them.
3. **Photos are hotlinked.** They load from `bsh-static.neuship.co`, and the house photo from the current site's image optimizer. Move them into the project and resize them before launch; some originals are about 6000px wide.
4. **The join form isn't connected.** Wire it to the current submission endpoint. I added one optional field ("What are you building, or looking for?"); drop it if the backend can't take it.
5. **Events were copied from Luma by hand** on 2026-09-24. In production, pull them from Luma or update the list after each event.
6. **The phone country list was cleaned up.** Current names (Eswatini, North Macedonia, Türkiye), the correct codes for the Cayman Islands, the Dominican Republic and Puerto Rico, and the two Congos told apart.

## Porting to the production (Next.js) site

- `partials.js` becomes `<SiteHeader />`, `<SiteFooter />`, `<Logo />` and `<HouseSection active />`.
- The tokens in `site.css` move into CSS variables or a Tailwind theme.
- The scribble engine in `site.js` becomes one client component. It uses a seeded random generator, so every drawing comes out identical on every render.
