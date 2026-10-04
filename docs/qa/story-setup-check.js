(async () => {
  // Run on a fresh Story workspace. No real Google account or Drive writes.
  const $ = selector => document.querySelector(selector), checks = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); };
  const wait = async predicate => {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw new Error('Story setup did not settle');
  };
  await wait(() => [...($('#profile')?.options || [])].filter(o => o.value).length === 600 && $('#driveProduct').options.length > 1);
  check('App icon replaces Tenzen in header', !!$('.topbar .workspace-brand-icon') && !$('.topbar .brand__mark') && !$('.topbar').textContent.includes('Tenzen'));
  check('Google Reel icon has matching normalized outline', $('#i-reel').dataset.source === 'google-material-symbols' && (60 + Number($('#i-reel').getAttribute('stroke-width'))) / 40 === Number($('#i-carousel').getAttribute('stroke-width')));
  check('Connection is above both editor columns', $('#driveConnection').parentElement.classList.contains('story-editor') && !$('#driveConnect').closest('.story-controls'));
  check('Product is the first sidebar section', $('.story-controls').firstElementChild.classList.contains('story-product'));
  check('Save action is beside previews', !!$('#driveSave').closest('.story-toolbar'));
  check('Disconnected state is explicit and gates randomize', $('#driveConnectionStatus').textContent === 'Not connected' && $('#randomProfile').disabled);
  const previousGoogle = window.google;
  let answer;
  window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => { answer = config.callback; } }) } } };
  try {
    $('#driveConnect').click();
    check('Connecting state stays visible and prevents duplicate attempts', $('#driveConnection').dataset.state === 'connecting' && $('#driveConnect').disabled && $('#randomProfile').disabled);
    answer({ error: 'access_denied' });
    await wait(() => $('#driveConnection').dataset.state === 'error');
    check('Failed connection offers retry without enabling randomize', !$('#driveConnect').disabled && $('#randomProfile').disabled && $('#driveSave').disabled && $('#driveConnectionNote').textContent.includes('access_denied'));
    check('Manual profiles remain available after connection failure', !$('#profile').disabled && [...$('#profile').options].filter(o => o.value).length === 600);
  } finally { window.google = previousGoogle; }
  const track = $('#storyTrack');
  for (let i = 0; i < 4; i++) $('#addStory').click();
  for (const side of ['first', 'last']) {
    const card = track[side === 'first' ? 'firstElementChild' : 'lastElementChild'];
    card.querySelector('.story-select').click();
    track.scrollTo({ left: side === 'first' ? 0 : track.scrollWidth, behavior: 'instant' });
    await new Promise(resolve => setTimeout(resolve, 100));
    const preview = card.querySelector('.story-preview'), box = preview.getBoundingClientRect(), clip = track.getBoundingClientRect();
    const css = getComputedStyle(preview), ring = parseFloat(css.outlineWidth) + parseFloat(css.outlineOffset);
    check(`${side} selected story ring fits inside scroll viewport`, box.left - ring >= clip.left - 1 && box.right + ring <= clip.right + 1 && box.top - ring >= clip.top && box.bottom + ring <= clip.bottom);
  }
  const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
  check('Moved controls retain unique IDs', ids.length === new Set(ids).size);
  check('No horizontal page overflow', document.documentElement.scrollWidth <= innerWidth);
  return { passed: checks.length, checks };
})()
