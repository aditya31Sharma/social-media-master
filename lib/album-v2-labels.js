import { defaultLabels, wireAlbumText } from './album-text.js';
export { wireAlbumText };
export function introLabels() {
  return defaultLabels().map(label => ({ ...label, font: 'Geist', color: '#ffffff',
    ...(label.id === 'heading' ? { text: 'Tenzen Presents', y: .45, size: 80, weight: 600 } : {}),
    ...(label.id === 'creator' ? { y: .55, size: 36 } : {}),
  }));
}
const number = (key, title, min, max, step = 1) => `<label class="field"><span>${title}</span><input class="input" type="number" data-text-${key} min="${min}" max="${max}" step="${step}"></label>`;
export function introControls() {
  return `<details><summary>Intro text</summary>
  <label class="field"><span>Edit text</span><select class="input" data-layer><option value="heading">Heading</option><option value="album">Album name</option><option value="creator">Creator</option></select></label>
  <label class="check"><input type="checkbox" data-text-enabled checked><span>Show this label</span></label>
  <label class="field"><span>Text</span><textarea class="input" data-text-text rows="2"></textarea></label>
  <label class="field"><span>Font</span><select class="input" data-font><option>Geist</option><option>Plus Jakarta Sans</option><option>Arial</option><option>Georgia</option></select></label>
  <div class="album-button-row"><button type="button" class="btn" data-local-fonts>Use local fonts</button><label class="btn album-upload">Add font file<input type="file" data-font-upload accept=".ttf,.otf,.woff,.woff2"></label></div>
  <div class="album-grid">${number('size', 'Font size', 8, 240)}${number('spacing', 'Letter spacing', -10, 60, .5)}${number('lineHeight', 'Line height', .5, 3, .05)}
  <label class="field"><span>Color</span><input class="input" type="color" data-text-color></label>
  <label class="field"><span>Weight</span><select class="input" data-text-weight>${[300,400,500,600,700,800,900].map(w => `<option>${w}</option>`).join('')}</select></label>
  <label class="field"><span>Alignment</span><select class="input" data-text-align><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
  ${number('x', 'Horizontal %', 0, 100, .1)}${number('y', 'Vertical %', 0, 100, .1)}</div>
  <label class="check"><input type="checkbox" data-text-italic><span>Italic</span></label>
  <div class="album-button-row"><button type="button" class="btn" data-center-x>Center horizontally</button><button type="button" class="btn" data-center-y>Center vertically</button></div>
  <p class="note">Drag labels in Edit intro. Center guides appear as you move.</p></details>`;
}
