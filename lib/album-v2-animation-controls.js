import { animationDefaults, ANIMATION_STYLES } from './album-v2-brand-motion.js';

export function wireEndingAnimation(scope, ending, changed, preview) {
  const panel = document.createElement('details'); panel.className = 'v2-animation'; panel.open = true;
  const number = (key, label, min, max, step) => `<label class="field" data-animation-field="${key}"><span>${label}</span><input class="input" type="number" data-animation="${key}" min="${min}" max="${max}" step="${step}"></label>`;
  panel.innerHTML = `<summary>Animation</summary>
    <label class="field"><span>Entrance</span><select class="input" data-animation="style">${ANIMATION_STYLES.map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
    <div class="album-grid">${number('duration','Duration (s)',.1,3,.01)}${number('delay','Delay (s)',0,2,.05)}</div>
    <label class="field" data-animation-field="easing"><span>Easing</span><select class="input" data-animation="easing"><option value="snappy">Snappy</option><option value="smooth">Smooth</option><option value="linear">Linear</option></select></label>
    ${number('scaleIn','Starting size %',0,95,1)}${number('scaleOut','Starting size %',105,250,1)}${number('distance','Travel distance %',20,150,1)}
    <div class="album-button-row"><button class="btn" type="button" data-animation-preview>Preview animation</button><button class="btn" type="button" data-animation-all>Apply to all ending layers</button></div>`;
  scope.prepend(panel);
  let selected = ending.labels[0];
  const inputs = [...panel.querySelectorAll('[data-animation]')];
  function sync() {
    if (!selected) return;
    const animation = selected.animation ||= animationDefaults();
    for (const input of inputs) input.value = animation[input.dataset.animation];
    for (const [key, show] of [['duration',animation.style !== 'instant'], ['easing',animation.style !== 'instant'], ['scaleIn',animation.style === 'scale-in'], ['scaleOut',animation.style === 'scale-out'], ['distance',animation.style.startsWith('slide-')]]) {
      panel.querySelector(`[data-animation-field="${key}"]`).hidden = !show;
    }
  }
  for (const input of inputs) input.addEventListener('input', () => {
    if (input.type === 'number' && (!input.value || !input.checkValidity())) return;
    selected.animation[input.dataset.animation] = input.type === 'number' ? input.valueAsNumber : input.value;
    sync(); changed();
  });
  panel.querySelector('[data-animation-preview]').addEventListener('click', preview);
  panel.querySelector('[data-animation-all]').addEventListener('click', () => {
    for (const layer of [...ending.labels, ending.brand, ending.link]) layer.animation = { ...selected.animation };
    changed();
  });
  sync();
  return { select(id) {
    panel.hidden = id === 'models';
    selected = ending.labels.find(label => label.id === id) || ending[id];
    sync();
  } };
}
