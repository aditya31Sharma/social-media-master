import { albumTextControls } from './album-text-controls.js';
import { artworkControls } from './album-v2-artwork.js';
import { defaultLabels } from './album-text.js';
export function introLabels() {
  return defaultLabels().filter(label => label.id !== 'album').map(label => ({ ...label, font: 'Geist', color: '#ffffff', weight: 400, italic: false,
    ...(label.id === 'heading' ? { text: 'Tenzen Presents', y: .5, size: 68 } : { y: .56, size: 36 }),
  }));
}
export function introControls() {
  return `<details open data-v2-intro-controls><summary>Intro</summary><section id="v2IntroEditor">
  <details class="v2-style-group"><summary>Logo</summary>${artworkControls({ intro: true })}</details>
  <details class="v2-style-group" open><summary>Text</summary>${albumTextControls({ includeAlbum: false, font: 'Geist', nativeFonts: true })}</details>
  </section></details>`;
}
