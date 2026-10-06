export function wireValueSliders(root) {
  const pairs = [];
  for (const input of root.querySelectorAll('input[type="number"]')) {
    const field = input.closest('label'); if (!field) continue;
    field.classList.add('v2-number-field');
    const slider = document.createElement('input'); slider.type = 'range'; slider.className = 'v2-value-slider';
    for (const key of ['min','max','step']) slider[key] = input[key] || (key === 'step' ? '1' : '0');
    slider.setAttribute('aria-label', field.querySelector('span').textContent); slider.value = input.value;
    slider.addEventListener('input', () => { input.value = slider.value; input.dispatchEvent(new Event('input', { bubbles: true })); });
    input.addEventListener('input', () => { if (input.checkValidity()) slider.value = input.value; });
    field.append(slider); pairs.push([input,slider]);
  }
  return { sync() { for (const [input,slider] of pairs) slider.value = input.value; } };
}

export function wireLayerInspector(scope, textEditor, artworkEditor, { ending = false, changed, onSelect = () => {} }) {
  const text = scope.querySelector('[data-layer]').closest('.v2-style-group');
  const artwork = scope.querySelector('[data-artwork-controls]').closest('.v2-style-group');
  const models = ending ? scope.parentElement.querySelector('[data-v2-lineup-controls]') : null;
  const media = scope.querySelector('[data-intro-media]');
  const layers = [...(media ? [{ id:'background', kind:'media', name:'Background' }] : []), { id:'heading', kind:'text', name:'Heading' }, { id:'creator', kind:'text', name:'Subheading' }, { id:'brand', kind:'artwork', name:'Tenzen logo' }, ...(ending ? [{ id:'link', kind:'artwork', name:'Globe link' }, { id:'models', kind:'models', name:'Models' }] : [])];
  const list = document.createElement('div'); list.className = 'v2-layer-list'; list.setAttribute('role','listbox'); list.setAttribute('aria-label','Layers');
  let selected = layers[0];
  function select(id, seek = true) {
    selected = layers.find(layer => layer.id === id); if (!selected) return;
    if (media) media.hidden = selected.kind !== 'media';
    text.hidden = selected.kind !== 'text'; artwork.hidden = selected.kind !== 'artwork';
    if (models) models.hidden = selected.kind !== 'models';
    text.open = true; artwork.open = true;
    if (selected.kind === 'text') textEditor.select(id);
    if (selected.kind === 'artwork') artworkEditor.select(id);
    for (const button of list.children) { button.setAttribute('aria-selected',String(button.dataset.layerId === id)); button.tabIndex = button.dataset.layerId === id ? 0 : -1; }
    onSelect(id);
    if (seek) changed();
  }
  for (const layer of layers) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.layerId = layer.id; button.setAttribute('role','option');
    const glyph = document.createElement('span'); glyph.textContent = layer.kind === 'text' ? 'T' : layer.kind === 'artwork' ? '◇' : layer.kind === 'media' ? '▧' : '▥'; glyph.setAttribute('aria-hidden','true');
    button.append(glyph, document.createTextNode(layer.name)); button.addEventListener('click', () => select(layer.id)); list.append(button);
  }
  list.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const offset = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
    const index = (layers.indexOf(selected)+offset+layers.length)%layers.length; select(layers[index].id); list.children[index].focus();
  });
  (ending ? scope.parentElement : scope).prepend(list);
  scope.querySelector('[data-layer]').parentElement.hidden = true;
  scope.querySelector('[data-art-layer]').parentElement.hidden = true;
  select(media ? 'background' : ending ? 'models' : 'heading',false);
  return { select, get selected() { return selected; } };
}
