// Keep keyboard focus in the top editing surface, including nested Reel sheets.
export function wireEditingDialogs() {
  const surfaces = [...document.querySelectorAll('#reelSetup, #photoPicker, #photoAdjust, #editor, #albumSetup, #albumV2Setup')];
  const background = [...document.querySelectorAll('.topbar, .workspace-heading, .workspace-nav, #toolWorkspace, #storyWorkspace')];
  const returnFocus = new Map();
  let active = null;
  const focusable = root => [...root.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]')]
    .filter(element => !element.disabled && element.tabIndex >= 0 && element.checkVisibility());

  function sync() {
    const next = surfaces.filter(surface => !surface.hidden).at(-1) || null;
    surfaces.forEach(surface => { surface.inert = !surface.hidden && surface !== next; });
    background.forEach(element => { element.inert = !!next; });
    document.body.classList.toggle('is-locked', !!next);
    if (next === active) return;
    const previous = active;
    if (next && !returnFocus.has(next)) returnFocus.set(next, document.activeElement);
    active = next;
    if (previous?.hidden) {
      const target = returnFocus.get(previous);
      returnFocus.delete(previous);
      if (target?.isConnected && (!next || next.contains(target))) target.focus({ preventScroll: true });
    }
    if (next && !next.contains(document.activeElement)) focusable(next)[0]?.focus({ preventScroll: true });
  }
  const observer = new MutationObserver(sync);
  surfaces.forEach(surface => observer.observe(surface, { attributes: true, attributeFilter: ['hidden'] }));
  document.addEventListener('keydown', event => {
    if (!active || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape' && active.id !== 'editor') {
      const close = active.querySelector('#reelSetupBack, [data-album-close], [data-v2-close], [data-pk-close], [data-aj-done]');
      if (close) { event.preventDefault(); event.stopImmediatePropagation(); close.click(); }
    }
    if (event.key !== 'Tab') return;
    const elements = focusable(active), first = elements[0], last = elements.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);
}
