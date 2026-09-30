# Social Media Master

An internal tool for one person. It turns a cover shot and a Tenzen product
link into the six 3:4 slides of an Instagram carousel, plus the caption, and
saves them as individual files.

**Register: product.** Design serves the task. The tool should disappear into
the job of getting a post out.

## Who uses it

Aditya, who runs Tenzen. Usually on a phone, often standing up, usually right
before posting. Not a designer sitting at a desk with time to read a form.

## What it has to get right

1. **The phone is the primary surface.** The desktop sidebar is the secondary
   one. A control that works on a mouse and fails under a thumb has failed.
2. **The default path is three things**: pick a product, add a cover, build.
   Everything else arrives filled in from the catalogue and folds away.
3. **What is on screen is what gets exported.** The editor and the export
   share one piece of placement arithmetic, never two.
4. **No server.** Everything runs in the browser, which is what lets it sit on
   GitHub Pages. The Shopify Storefront token it ships is public and read-only
   by design.

## Constraints

- Plain HTML, CSS and ES modules. No framework, no build step.
- Icons are a hand-rolled SVG sprite in `index.html` (`#i-*`). One set only.
- Tokens live at the top of `app.css`. Helvetica Neue, the brand's face.
- Every `min-width: 900px` override lives in ONE block at the end of
  `app.css`. Three separate cascade bugs came from breaking that rule.
- Phone-only styling goes in the `max-width: 899px` block before it, so the
  two never fight.

## Voice

Labels, not sentences. A control says what it does. If a line of copy is only
explaining a control that could explain itself, cut the line.
