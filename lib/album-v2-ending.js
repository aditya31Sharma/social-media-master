export const endingDefaults = () => ({ gap: -20, x: 50, y: 50 });
export function endingControls() {
  return `<details><summary>Ending</summary>
    <label class="field"><span>Gap between models <output data-v2-gap-value>-20 px</output></span><input type="range" data-v2-ending="gap" min="-60" max="100" step="1" value="-20"></label>
    <div class="album-grid"><label class="field"><span>Group horizontal %</span><input class="input" type="number" data-v2-ending="x" min="0" max="100" value="50"></label>
    <label class="field"><span>Group vertical %</span><input class="input" type="number" data-v2-ending="y" min="0" max="100" value="50"></label></div>
    <div class="album-button-row"><button class="btn" type="button" data-v2-center="x">Center horizontally</button><button class="btn" type="button" data-v2-center="y">Center vertically</button></div>
    </details>`;
}
export function wireEndingControls(root, settings, repaint) {
  for (const input of root.querySelectorAll('[data-v2-ending]')) {
    input.addEventListener('input', () => {
      if (!Number.isFinite(input.valueAsNumber)) return;
      const key = input.dataset.v2Ending;
      settings[key] = Math.max(+input.min, Math.min(+input.max, input.valueAsNumber));
      if (key === 'gap') root.querySelector('[data-v2-gap-value]').textContent = `${settings.gap} px`;
      repaint();
    });
    input.addEventListener('change', () => { input.value = settings[input.dataset.v2Ending]; });
  }
  for (const button of root.querySelectorAll('[data-v2-center]')) button.addEventListener('click', () => {
    const axis = button.dataset.v2Center; settings[axis] = 50;
    root.querySelector(`[data-v2-ending="${axis}"]`).value = 50; repaint();
  });
}
