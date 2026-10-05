# Album V2 typography and artwork editors

Local only; preserve the 40-second animation and all existing templates.

- Correct the detail grid to orthogonal 120px squares. Center the garment canvas and product labels at x754 (text moves 16px left).
- Extend shared text controls with an opt-in native-font picker. Group local font faces by family; searchable previews plus a real face selector. Load each face into its own family at normal CSS weight/style, avoiding synthetic bold/italic. Preserve V1 controls.
- Add shared SVG size, color and X/Y controls to intro and outro. Intro defaults: logo25%, x50/y42%; regular heading x50/y50%, creator x50/y56%.
- Reuse the complete text editor for outro heading/subheading. Preserve original wordmark and globe SVG; expose transforms for both. Keep text editors scoped and their drag handlers active only on the appropriate frame.
- Add four independent right-side gaps between adjacent models, each -20px. Keep the global gap control as a convenience that updates all four. Group movement carries all ending artwork and text.
- Validate fonts with multiple faces in one family, intro/outro independent editing, positioning, gap layout, browser resize and an actual export. Update README, Constitution and recovery manifest.
