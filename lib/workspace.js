import { wireEditingDialogs } from './dialogs.js';

const TOOLS = {
  carousel: { title: 'Carousel', description: 'One SKU, six slides.', meta: '6 slides · 3:4', add: 'Add carousel' },
  reel: { title: 'Reel', description: 'One outfit. Two garments turning together.', meta: '15 seconds · 9:16', add: 'Set up the reel' },
  story: { title: 'Story', description: 'Turn customer photos into review stories.', meta: 'WebP · Instagram', add: 'Add story' },
};

export function createWorkspace({ onChange, onAdd }) {
  wireEditingDialogs();
  const $ = selector => document.querySelector(selector);
  const tabs = [...document.querySelectorAll('[data-tpl]')];
  const host = $('#storyWorkspace');
  const scroll = new Map();
  let active = null, story = null, loading = null;

  async function loadStory() {
    if (story) return story;
    if (loading) return loading;
    const placeholder = host.querySelector('.workspace-loading');
    const note = placeholder.querySelector('p');
    const retry = $('#retryStory');
    retry.hidden = true;
    placeholder.querySelector('h2').textContent = 'Opening Story creator';
    note.textContent = 'Loading your editing tools.';
    const timer = setTimeout(() => { note.textContent = 'Still connecting. Check your internet, or try again.'; }, 6000);
    loading = (async () => {
      try {
        const [response, module] = await Promise.all([
          fetch(new URL('../stories/index.html?v=20261004-reel2', import.meta.url), { signal: AbortSignal.timeout(15000) }),
          import('../stories/story.js'),
        ]);
        if (!response.ok) throw new Error('Story tools could not load.');
        const source = new DOMParser().parseFromString(await response.text(), 'text/html');
        const editor = source.querySelector('.story-editor');
        const template = source.querySelector('#storyTemplate');
        if (!editor || !template) throw new Error('Story tools could not load.');
        host.append(document.importNode(editor, true), document.importNode(template, true));
        if (!document.querySelector('#googleIdentity')) {
          const script = document.createElement('script');
          script.id = 'googleIdentity'; script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
          document.head.append(script);
        }
        story = await module.mountStory(host, { isActive: () => active === 'story' });
        placeholder.hidden = true;
        foldStorySettings(host);
        return story;
      } catch (error) {
        host.querySelector('.story-editor')?.remove();
        host.querySelector('#storyTemplate')?.remove();
        placeholder.querySelector('h2').textContent = 'Story could not open';
        note.textContent = `${error.message} Try again.`;
        retry.hidden = false;
        return null;
      } finally { clearTimeout(timer); loading = null; }
    })();
    return loading;
  }

  function select(which, updateHistory = true) {
    if (!TOOLS[which] || active === which) return;
    if (active) scroll.set(active, window.scrollY);
    active = which;
    document.body.dataset.tool = which;
    document.body.classList.remove('is-over');
    const tool = TOOLS[which];
    $('#workspaceTitle').textContent = tool.title;
    $('#workspaceDescription').textContent = tool.description;
    $('#workspaceMeta').textContent = $('#previewMeta').textContent = tool.meta;
    $('#workspaceAdd').setAttribute('aria-label', tool.add);
    $('#workspaceAdd').title = tool.add;
    tabs.forEach(tab => {
      const on = tab.dataset.tpl === which;
      tab.classList.toggle('is-on', on);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== which; });
    $('#toolWorkspace').hidden = which === 'story';
    host.hidden = which !== 'story';
    document.querySelectorAll('.combo__list').forEach(list => { list.hidden = true; });
    if (which !== 'reel') $('#reelOut video').pause();
    onChange(which);
    if (updateHistory) history.pushState(null, '', `#${which}`);
    if (which === 'story') loadStory();
    requestAnimationFrame(() => window.scrollTo({ top: scroll.get(which) || 0, behavior: 'instant' }));
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.tpl));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault(); tabs[next].focus(); select(tabs[next].dataset.tpl);
    });
  });
  $('#workspaceAdd').addEventListener('click', async () => {
    if (active === 'story') (await loadStory())?.addStory();
    else onAdd(active);
  });
  $('#retryStory').addEventListener('click', loadStory);
  window.addEventListener('hashchange', () => select(location.hash.slice(1) || 'carousel', false));
  document.querySelectorAll('[data-open-settings]').forEach(button => button.addEventListener('click', () => $('#settingsDialog').showModal()));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  });
  $('#btnReset').addEventListener('click', () => { $('#settingsDialog').close(); $('#resetDialog').showModal(); });
  $('#confirmReset').addEventListener('click', () => location.reload());
  select(TOOLS[location.hash.slice(1)] ? location.hash.slice(1) : 'carousel', false);
}

function foldStorySettings(root) {
  const secondary = ['Timestamp', 'Progress fill', 'Photo position', 'Export size'];
  root.querySelectorAll('.story-section').forEach(section => {
    const heading = section.querySelector('h2, :scope > label');
    if (!heading || !secondary.includes(heading.textContent)) return;
    const details = document.createElement('details');
    details.className = 'story-fold';
    const summary = document.createElement('summary');
    summary.textContent = heading.textContent;
    section.before(details); details.append(summary, section);
    heading.classList.add('sr-only');
  });
}
