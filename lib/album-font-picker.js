export function groupFontFamilies(fonts) {
  const families = new Map();
  for (const font of fonts) {
    const family = font.family || font.fullName;
    if (!families.has(family)) families.set(family, { name: family, faces: [] });
    const faces = families.get(family).faces;
    if (!faces.some(face => face.postscriptName === font.postscriptName)) faces.push(font);
  }
  return [...families.values()].sort((a, b) => a.name.localeCompare(b.name)).map(group => ({ ...group,
    faces: group.faces.sort((a, b) => Number(!/^(regular|normal|roman|book)$/i.test(a.style)) - Number(!/^(regular|normal|roman|book)$/i.test(b.style)) || a.style.localeCompare(b.style)),
  }));
}

export function wireFontPicker(root, getLabel, changed, report, onBusy) {
  const select = root.querySelector('[data-font]'), groups = [], loaded = new Map();
  let serial = 0, version = 0, active = null;
  for (const option of select.options) groups.push({ name: option.text, section: 'Included', faces: [{ style: 'Regular', key: option.value, loaded: option.value }] });
  const host = document.createElement('div'); host.className = 'album-font-picker';
  host.innerHTML = `<button class="input" type="button" data-font-menu aria-label="Font family" aria-expanded="false">Geist</button>
    <div class="album-font-popup" hidden><input class="input" type="search" data-font-search placeholder="Search font families" aria-label="Search font families"><div class="album-font-list" aria-label="Font families"></div></div>
    <label class="field"><span>Style</span><select class="input" data-font-face></select></label>`;
  select.parentElement.after(host); select.parentElement.hidden = true;
  const button = host.querySelector('[data-font-menu]'), popup = host.querySelector('.album-font-popup'), list = host.querySelector('.album-font-list'), search = host.querySelector('[data-font-search]'), faceSelect = host.querySelector('[data-font-face]');
  function open() {
    render(); button.scrollIntoView({ block: 'nearest' });
    const frame = root.closest('.album-controls').getBoundingClientRect(), rect = button.getBoundingClientRect();
    const above = rect.top - frame.top - 12, below = frame.bottom - rect.bottom - 12, up = below < 320 && above > below;
    popup.style.top = up ? 'auto' : `${button.offsetTop + button.offsetHeight}px`;
    popup.style.bottom = up ? `${host.offsetHeight - button.offsetTop}px` : 'auto';
    list.style.maxHeight = `${Math.max(80, Math.min(260, (up ? above : below) - 70))}px`;
    popup.hidden = false; button.setAttribute('aria-expanded', 'true'); search.focus({ preventScroll: true });
  }
  function close() { popup.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  function showFaces(group, key) {
    active = group; faceSelect.replaceChildren();
    for (const face of group.faces) faceSelect.add(new Option(face.style, face.key));
    if (key) faceSelect.value = key;
  }
  function sync() {
    const label = getLabel(); select.value = label.font;
    const group = groups.find(group => group.faces.some(face => (face.loaded || face.key) === label.font));
    if (!group) return;
    const face = group.faces.find(face => (face.loaded || face.key) === label.font);
    button.textContent = group.name; button.style.fontFamily = `"${label.font}", sans-serif`;
    showFaces(group, face.key);
  }
  async function choose(group, face) {
    const request = ++version, label = getLabel(); onBusy(1);
    try {
      if (!face.loaded) {
        if (!loaded.has(face.key)) loaded.set(face.key, (async () => {
          const family = `AlbumFont${root.id}${++serial}`;
          // Each real face has its own normal-weight family; the glyphs carry its style.
          const font = await new FontFace(family, await (await face.blob()).arrayBuffer(), { weight: '400', style: 'normal' }).load();
          document.fonts.add(font); select.add(new Option(`${group.name} ${face.style}`, family)); return family;
        })().catch(error => { loaded.delete(face.key); throw error; }));
        face.loaded = await loaded.get(face.key);
      }
      if (request !== version) return;
      label.font = face.loaded; label.weight = 400; label.italic = false;
      sync(); changed(); close();
    } catch (error) { report(`Font could not load: ${error.message}`); sync(); }
    finally { onBusy(-1); }
  }
  function render() {
    list.replaceChildren(); const query = search.value.toLocaleLowerCase();
    for (const section of ['Included', 'Local fonts', 'Uploaded']) {
      const matches = groups.filter(group => group.section === section && group.name.toLocaleLowerCase().includes(query));
      if (!matches.length) continue;
      const heading = document.createElement('p'); heading.textContent = section; heading.className = 'note'; list.append(heading);
      for (const group of matches) {
        const row = document.createElement('button'); row.type = 'button'; row.className = 'album-font-option';
        const sample = document.createElement('span'); sample.textContent = group.name; sample.style.fontFamily = `"${group.faces[0].loaded || group.name}", sans-serif`;
        const count = document.createElement('small'); count.textContent = `${group.faces.length} ${group.faces.length === 1 ? 'style' : 'styles'}`;
        row.append(sample, count); row.addEventListener('click', () => choose(group, group.faces[0])); list.append(row);
      }
    }
  }
  button.addEventListener('click', () => { if (!popup.hidden) { close(); return; } open(); });
  search.addEventListener('input', render);
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !popup.hidden) { event.preventDefault(); event.stopPropagation(); close(); button.focus(); }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || popup.hidden) return;
    const rows = [...list.querySelectorAll('button')], index = rows.indexOf(document.activeElement);
    if (rows.length) { event.preventDefault(); rows[(index + (event.key === 'ArrowDown' ? 1 : rows.length - 1) + rows.length) % rows.length].focus(); }
  });
  document.addEventListener('pointerdown', event => { if (!host.contains(event.target)) close(); });
  faceSelect.addEventListener('change', () => choose(active, active.faces.find(face => face.key === faceSelect.value)));
  select.addEventListener('change', () => {
    const group = groups.find(group => group.faces.some(face => (face.loaded || face.key) === select.value));
    if (group) choose(group, group.faces.find(face => (face.loaded || face.key) === select.value));
  });
  root.querySelector('[data-local-fonts]').addEventListener('click', async () => {
    if (!window.queryLocalFonts) { report('Use Add font file to load a local font in this browser.'); return; }
    try {
      const families = groupFontFamilies(await window.queryLocalFonts());
      for (const group of families) if (!groups.some(existing => existing.section === 'Local fonts' && existing.name === group.name)) groups.push({ ...group, section: 'Local fonts', faces: group.faces.map(face => ({ style: face.style, key: `local:${face.postscriptName}`, blob: () => face.blob() })) });
      report(`${families.length} local font ${families.length === 1 ? 'family' : 'families'} available.`); open();
    } catch { report('Font access was not granted. Use Add font file instead.'); }
  });
  root.querySelector('[data-font-upload]').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const group = { name: file.name.replace(/\.[^.]+$/, ''), section: 'Uploaded', faces: [{ style: 'Original', key: `upload:${++serial}`, blob: async () => file }] };
    groups.push(group); await choose(group, group.faces[0]); event.target.value = '';
  });
  sync(); return { sync };
}
