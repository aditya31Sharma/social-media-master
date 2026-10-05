const number = (key, title, value, min, max, step = 1) => `<label class="field"><span>${title}</span><input class="input" type="number" data-text-${key} value="${value}" min="${min}" max="${max}" step="${step}"></label>`;

export function albumTextControls({ includeAlbum = true, font = 'Plus Jakarta Sans', nativeFonts = false, previewName = 'the Intro preview' } = {}) {
  return `<label class="field"><span>Edit text</span><select class="input" data-layer><option value="heading">Heading</option>${includeAlbum ? '<option value="album">Album name</option>' : ''}<option value="creator">Creator</option></select></label>
          <label class="check"><input type="checkbox" data-text-enabled checked><span>Show this label</span></label>
          <label class="field"><span>Text</span><textarea class="input" data-text-text rows="2" placeholder="Enter text"></textarea></label>
          <label class="field"><span>Font</span><select class="input" data-font><option>${font}</option>${font !== 'Plus Jakarta Sans' ? '<option>Plus Jakarta Sans</option>' : ''}<option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option></select></label>
          <div class="album-button-row"><button type="button" class="btn" data-local-fonts>Use local fonts</button><label class="btn album-upload">Add font file<input type="file" data-font-upload accept=".ttf,.otf,.woff,.woff2"></label></div>
          <div class="album-grid">
            ${number('size', 'Font size', 72, 8, 240)}${number('spacing', 'Letter spacing', 0, -10, 60, .5)}
            ${number('lineHeight', 'Line height', 1.2, .5, 3, .05)}
            <label class="field"><span>Color</span><input class="input" type="color" data-text-color value="#111111"></label>
            ${nativeFonts ? '' : `<label class="field"><span>Weight</span><select class="input" data-text-weight>${[300,400,500,600,700,800,900].map(w => `<option>${w}</option>`).join('')}</select></label>`}
            <label class="field"><span>Alignment</span><select class="input" data-text-align><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            ${number('x', 'Horizontal %', 50, 0, 100, .1)}${number('y', 'Vertical %', 25, 0, 100, .1)}
          </div>
          ${nativeFonts ? '' : '<label class="check"><input type="checkbox" data-text-italic><span>Italic</span></label>'}
          <div class="album-button-row"><button type="button" class="btn" data-center-x>Center horizontally</button><button type="button" class="btn" data-center-y>Center vertically</button></div>
          <p class="note">Drag labels in ${includeAlbum ? 'Edit intro' : previewName}. Center guides appear as you move.</p>`;
}
