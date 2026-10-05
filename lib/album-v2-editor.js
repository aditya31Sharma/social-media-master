import { PHOTO_STARTS, frontPhotoIndex } from './album-v2-motion.js';

export function wireGalleryEditor(root, seek) {
  const controls = root.querySelector('.album-controls'), panels = [...controls.querySelectorAll(':scope > details')];
  const nav = document.createElement('div'); nav.className = 'v2-sections'; nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Album settings');
  function select(index, focus = false) {
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    [...nav.children].forEach((button, i) => { button.setAttribute('aria-selected', String(i === index)); button.tabIndex = i === index ? 0 : -1; });
    if (focus) nav.children[index].focus();
  }
  ['Intro', 'Products', 'Export'].forEach((name, index) => {
    const panel = panels[index]; panel.open = true; panel.id = `v2-panel-${index}`; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', `v2-tab-${index}`);
    const button = document.createElement('button'); button.type = 'button'; button.textContent = name; button.id = `v2-tab-${index}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => { select(index); if (index === 0) seek(-1); if (index === 1) seek(+(root.querySelector('[data-v2-product][open]')?.dataset.v2Product || 0)); }); nav.append(button);
  });
  nav.addEventListener('keydown', event => {
    const index = [...nav.children].indexOf(document.activeElement); let next;
    if (event.key === 'ArrowRight') next = (index + 1) % 3;
    if (event.key === 'ArrowLeft') next = (index + 2) % 3;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 2;
    if (next !== undefined) { event.preventDefault(); select(next, true); }
  });
  controls.insertBefore(nav, panels[0]); select(0);
  const chapters = document.createElement('div'); chapters.className = 'v2-chapters'; chapters.setAttribute('aria-label', 'Preview section');
  ['Intro', '1', '2', '3', '4', '5', 'Logo'].forEach((name, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = name; button.dataset.v2Chapter = i - 1;
    button.setAttribute('aria-label', i === 0 ? 'Preview intro' : i === 6 ? 'Preview ending' : `Preview product ${i}`);
    button.addEventListener('click', () => { seek(i - 1); if (i === 0) select(0); if (i === 6) select(2); if (i > 0 && i < 6) { select(1); const row = root.querySelector(`[data-v2-product="${i - 1}"]`); if (row) row.open = true; } }); chapters.append(button);
  });
  root.querySelector('.album-preview').append(chapters);
  return { select, highlight(index) { for (const button of chapters.children) button.setAttribute('aria-pressed', String(+button.dataset.v2Chapter === index)); } };
}
function thumbnail(image, width, height) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const scale = Math.max(width / image.width, height / image.height);
  canvas.getContext('2d').drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2, image.width * scale, image.height * scale);
  return canvas;
}
export function productRows(host, models, upload, selected, onOpen) {
  host.replaceChildren();
  models.forEach((asset, i) => {
    if (!asset) return;
    const row = document.createElement('details'); row.className = 'v2-product'; row.dataset.v2Product = i; row.open = i === selected;
    row.innerHTML = `<summary><span class="album-model__number">${i + 1}</span><span class="album-model__thumb"></span><span class="v2-product-title"><strong></strong><small></small></span><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-down"/></svg></summary><div class="v2-product-body"><div class="v2-photos"></div><label class="field"><span>Product name</span><input class="input" data-v2-name="${i}" maxlength="160"></label><div class="v2-product-actions">${upload(`glb-${i}`, 'Replace 3D garment', '.glb')}<div class="album-order"><button type="button" class="btn" data-v2-move="${i}" data-step="-1" aria-label="Move product ${i + 1} earlier" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn" data-v2-move="${i}" data-step="1" aria-label="Move product ${i + 1} later" ${i === 4 ? 'disabled' : ''}>↓</button></div></div></div>`;
    row.querySelector('strong').textContent = asset.heading || asset.productName;
    row.querySelector('small').textContent = asset.sub || asset.type;
    row.querySelector('[data-v2-name]').value = asset.productName;
    row.querySelector('.album-model__thumb').append(thumbnail(asset.image, 44, 60));
    asset.photos.forEach((photo, shot) => {
      if (shot >= 2 && shot !== frontPhotoIndex(i)) return;
      const cell = document.createElement('div'); cell.className = 'v2-photo';
      const button = document.createElement('button'); button.type = 'button'; button.dataset.v2ShotPreview = `${i}-${shot}`; button.setAttribute('aria-label', `Preview ${photo.label} for ${asset.productName}`);
      button.append(thumbnail(photo.image, 100, 150)); const label = document.createElement('span'); label.textContent = photo.label; button.append(label);
      cell.append(button); cell.insertAdjacentHTML('beforeend', upload(`photo-${i}-${shot}`, 'Replace', 'image/*,.heic,.heif')); row.querySelector('.v2-photos').append(cell);
    });
    row.addEventListener('toggle', () => { if (row.open && row.isConnected) onOpen(i); }); host.append(row);
  });
}
export const photoPreviewTime = shot => shot >= 2 ? 2.8 : (PHOTO_STARTS[shot] || .15) + .4;
