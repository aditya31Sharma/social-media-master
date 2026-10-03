(async () => {
  const $ = selector => document.querySelector(selector), checks = [];
  const check = (name, value) => { if (!value) throw new Error(name); checks.push(name); };
  const wait = async predicate => {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw new Error('Workspace did not finish loading');
  };
  const origin = performance.timeOrigin;
  $('#tabStory').click();
  await wait(() => $('#profile')?.options.length === 600);
  const canvas = $('.story-canvas');
  $('#timeValue').value = '17'; $('#timeValue').dispatchEvent(new Event('change'));
  const frame = canvas.toDataURL();
  $('#tabCarousel').click();
  check('Carousel active on the same document', document.body.dataset.tool === 'carousel' && !$('#toolWorkspace').hidden);
  const before = $('#prodInput').value;
  $('#tabReel').click();
  check('Reel controls available', !$('[data-panel=reel]').hidden && $('[data-panel=carousel]').hidden);
  $('#tabStory').click();
  check('Story draft canvas and timestamp survive tab switches', canvas === $('.story-canvas') && frame === canvas.toDataURL() && $('#timeValue').value === '17');
  check('Tabs do not navigate or embed another page', performance.timeOrigin === origin && !document.querySelector('iframe[src*="stories"]'));
  const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
  check('Combined document has unique IDs', ids.length === new Set(ids).size);
  check('Drive, HEIC, bulk download and profile controls retained', !!$('#driveSave') && $('.story-file').accept.includes('.heic') && !!$('#downloadAll') && $('#profile').options.length === 600);
  $('#tabCarousel').click();
  check('Carousel input survives switching', $('#prodInput').value === before);
  check('Build action belongs to its composer', $('#btnBuild').closest('#rail'));
  $('[data-open-settings]').click();
  check('Settings opens as a modal', $('#settingsDialog').open);
  $('[data-theme-choice=dark]').click();
  check('Dark theme applies', document.documentElement.dataset.theme === 'dark');
  $('[data-theme-choice=light]').click();
  check('Light theme applies', document.documentElement.dataset.theme === 'light');
  $('#btnReset').click();
  check('Start over requires confirmation', $('#resetDialog').open && !$('#settingsDialog').open);
  $('#resetDialog [data-close-dialog]').click();
  check('Keep editing retains drafts', performance.timeOrigin === origin && !$('#resetDialog').open && canvas === $('.story-canvas'));
  $('#tabStory').click();
  return { passed: checks.length, checks };
})()
