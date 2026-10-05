export const introBrand = () => ({ variant: 'japanese', color: '#ffffff', x: .5, y: .42, scale: .25, enabled: true });
export function artworkControls({ intro = false, link = false } = {}) {
  return `<section data-artwork-controls><label class="field"><span>Edit artwork</span><select class="input" data-art-layer><option value="brand">Tenzen logo</option>${link ? '<option value="link">Globe link</option>' : ''}</select></label>
    <label class="check"><input type="checkbox" data-art-enabled checked><span>Show artwork</span></label>
    <label class="field"><span>Tenzen logo</span><select class="input" data-art-variant ${intro ? 'data-v2-logo' : ''}><option value="japanese">Wordmark with Japanese text</option><option value="wordmark">Full wordmark</option><option value="asterisk">Asterisk</option><option value="globe">Globe link</option></select></label>
    <div class="album-grid"><label class="field"><span>Color</span><input class="input" type="color" data-art-color ${intro ? 'data-v2-logo-color' : ''}></label>
    <label class="field"><span>Size %</span><input class="input" type="number" data-art-scale min="5" max="200" step="1"></label>
    <label class="field"><span>Horizontal %</span><input class="input" type="number" data-art-x min="0" max="100" step=".1"></label>
    <label class="field"><span>Vertical %</span><input class="input" type="number" data-art-y min="0" max="100" step=".1"></label></div>
    <div class="album-button-row"><button class="btn" type="button" data-art-center="x">Center horizontally</button><button class="btn" type="button" data-art-center="y">Center vertically</button></div></section>`;
}
export function wireArtworkControls(root, artwork, changed) {
  const host = root.querySelector('[data-artwork-controls]'); let selected = artwork.brand;
  const keys = ['variant','color','scale','x','y','enabled'];
  function sync() {
    for (const key of keys) {
      const input = host.querySelector(`[data-art-${key}]`);
      if (key === 'enabled') input.checked = selected.enabled !== false;
      else input.value = ['x','y','scale'].includes(key) ? Math.round(selected[key]*1000)/10 : selected[key];
    }
  }
  host.querySelector('[data-art-layer]').addEventListener('change', event => { selected = artwork[event.target.value]; sync(); changed(); });
  for (const key of keys) host.querySelector(`[data-art-${key}]`).addEventListener('input', event => {
    const input = event.target;
    if (input.type === 'number') { if (!input.value || !input.checkValidity()) return; selected[key] = input.valueAsNumber/100; }
    else selected[key] = input.type === 'checkbox' ? input.checked : input.value;
    changed();
  });
  for (const button of host.querySelectorAll('[data-art-center]')) button.addEventListener('click', () => { selected[button.dataset.artCenter] = .5; sync(); changed(); });
  sync(); return { sync };
}
