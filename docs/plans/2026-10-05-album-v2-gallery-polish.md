# Album V2 gallery and editor polish

Local-only implementation. Preserve V1 and Outfit. No dependencies.

- Bundle each SKU's Macro-Front, Model-Man-Front-Full and
  Model-Woman-Front-Full alongside its existing Shoot-1. Show these four in
  this order with rightward slides; allow replacing each independently.
- Default gallery 40s, 8s per SKU, so four photos remain readable. Preserve
  23s and 30s choices. Intro 3s and ending 2.5s remain fixed and muted.
- Double stack spacing from y .22/z -.75 to y .44/z -1.5. Outgoing product
  moves upward, tilts and shrinks, then returns behind the stack offscreen.
- Use shutter sampling across the whole composition, including photo slides,
  camera/stack motion, glass entrance, garment rotation and bag animation.
- Floating card uses 20px left/right/bottom inset and 32px radius in a 390px
  design viewport, scaled proportionally into 720p/1080p video. Retain 60%
  height and garment/title/CTA, adapting inner layout to the smaller width.
- Implement rounded-lens WebGL refraction using the existing Three renderer,
  plus frosted backdrop, specular rim and soft shadow. Same effect in preview
  and export; no dependency on DOM-only backdrop filters.
- Editor has Intro/Products/Export sections, persistent large preview, compact
  product accordions and visible four-photo sequence. Keep Geist and design
  system tokens, touch targets and keyboard navigation.
- Verify timeline, image order, geometry, blur, local images and audio with
  tests; browser preview at four sizes/light/dark; real 1080p export.
- Update README, Constitution playbook and recovery manifest. Do not publish.

Research: Apple WWDC25 Meet Liquid Glass (lensing, highlights, shadows), and
GoogleChromeLabs css-web-ui-demos liquid_glass_reference (displacement map).

Completed locally: 71 unit tests, 24 V2/16 V1/24 Outfit browser checks, eight
light/dark viewport layouts, individual macro upload, keyboard navigation and
375x667 controls. Final 2730-frame 1080p export45.500s took93.072s. Recovery
verification covers785files. No publication.
