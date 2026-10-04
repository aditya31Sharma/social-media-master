# Album V2 intro, entrance and ending

Goal: the intro has only main text, one of the existing Tenzen SVG logos,
logo color, and subtext. Fix the incoming-card choreography from the reviewed
reference. End on a 5%-size final photo fading to black and the selected logo.

- Reuse Japanese wordmark in assets/logo.svg; bundle the supplied full wordmark
  and standalone asterisk SVGs from tenzen-storyboard/public/.
- Replace V2's label-editor controls with four fields. Fixed Geist layout;
  bundled three-second intro, muted. Heading/logo/subtext appear at 0.5s.
- Intro shrinks centrally while five cards rise tilted from below in staggered
  reverse order, straighten, settle, then first selected product fills 9:16.
- Keep product timing, one-second clear hold, rotating garment and bottom panel.
- Append a 2.5-second ending: dismiss panel, shrink final photo to 5%, fade to
  pure black, reveal selected logo/color and hold. Default total 28.5 seconds.
- Test muted audio, controls, entrance continuity, cover fit, ending scale/fade;
  inspect real browser frames, both logos/colors and full exported MP4.
- Update README, Constitution playbook and recovery manifest. No dependencies,
  V1/Outfit edits, HQ edits, file deletion or unsolicited PR.

Completed: 69 unit tests, 59 browser regressions, four viewport checks, full
1080p 28.5-second silent export and visual frame inspection all passed.
