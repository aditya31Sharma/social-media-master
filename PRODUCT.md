# Social Media Master

An internal tool for Aditya and his authorized team. It turns a cover shot and a Tenzen product
link into six 3:4 Carousel slides and a caption, two garments into a turning
Reel and its cover, five model photos into an Album showcase reel, and review photos into Instagram-style Stories. All three
tools live in one workspace and keep their drafts when switching tabs.

**Register: product.** Design serves the task. The tool should disappear into
the job of getting a post out.

## Who uses it

Aditya and the Tenzen team, often editing on a phone before posting. Desktop
editing should offer a compact canvas and a spacious, focused inspector.

## What it has to get right

1. **The phone is the primary surface.** The desktop sidebar is the secondary
   one. A control that works on a mouse and fails under a thumb has failed.
2. **The default path is three things**: pick a product, add a cover, build.
   Everything else arrives filled in from the catalogue and folds away.
3. **What is on screen is what gets exported.** The editor and the export
   share one piece of placement arithmetic, never two.
4. **Browser rendering.** Editing and export stay in the browser on GitHub
   Pages. YouTube audio import uses the authenticated HQ service. The Shopify
   Storefront token is public and read-only by design.
5. **Focused editing.** Album V2 separates Intro, Products, Ending, Audio and
   Export with a persistent timeline. Select a layer to expose its properties;
   video trimming and crop remain together under Intro > Background.

## Constraints

- Plain HTML, CSS and ES modules. No framework, no build step.
- Icons are a hand-rolled SVG sprite in `index.html` (`#i-*`). One set only.
- Workspace tokens live in `styles/tokens.css`, following the Aditya Tools
  Design System with colours derived from the supplied app icon. UI uses local Plus Jakarta Sans. Export renderers
  retain the original brand fonts and Story Roboto.
- `styles/workspace.css` loads after the original component styles and owns
  the responsive shell. Keep its desktop overrides in one 900px block.
- Phone navigation stays at the bottom with safe-area padding, touch targets
  are at least44px, primary actions54px, and text inputs16px to avoid iOS zoom.
- Light/Dark/System changes the UI only. Keep tool panels mounted and scope
  paste/drop handlers to the active tool. No Story iframe or separate page.

## Voice

Labels, not sentences. A control says what it does. If a line of copy is only
explaining a control that could explain itself, cut the line.
