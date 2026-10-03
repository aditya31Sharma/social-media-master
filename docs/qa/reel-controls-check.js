(async () => {
  const $ = selector => document.querySelector(selector), checks = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); };
  const wait = async predicate => {
    for (let i = 0; i < 300; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 50)); }
    throw new Error('Reel controls timed out');
  };
  const tick = () => new Promise(resolve => setTimeout(resolve, 30));
  const set = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new Event('input', { bubbles: true })); };
  $('#tabReel').click();
  await wait(() => /\d+ products/.test($('#prodNote').textContent));
  for (const [id, query] of [['topInput', 'absolute cinema'], ['botInput', 'angels motor']]) {
    $(`#${id}`).focus(); set(`#${id}`, query);
    await wait(() => $(`#${id}-options [data-handle]`) && !$(`#${id}-options`).hidden);
    $(`#${id}`).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    $(`#${id}`).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  await wait(() => !$('#reelAfter').hidden);
  check('Both garments selected using keyboard', $('#topInput').value.includes('Absolute Cinema') && $('#botInput').value.includes('Angels Motor'));
  $('#btnSetup').click(); await tick();
  check('Setup traps focus and makes workspace inert', $('#toolWorkspace').inert && $('#reelSetup').contains(document.activeElement));
  check('Phone setup does not overflow', $('#reelSetup .setup__head').getBoundingClientRect().right <= innerWidth + 1);
  for (const slot of ['tl', 'tr', 'bl', 'br']) {
    $(`[data-slot=${slot}]`).click(); await tick();
    $('#photoPicker .pk__cell').click();
    if (slot === 'tl') {
      $('.pk__adjust').click(); await wait(() => $('[data-aj-img]').naturalWidth > 0); await tick();
      set('[data-aj-zoom]', '1.2');
      check('Photo framing changes zoom', $('[data-aj-zoomout]').textContent === '120%');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
      check('Escape closes only the top photo sheet', $('#photoAdjust').hidden && !$('#photoPicker').hidden && !$('#reelSetup').hidden);
    }
    $('[data-pk-done]').click(); await tick();
  }
  check('Four chosen photos enable generation', !$('#btnReelGo').disabled && document.querySelectorAll('.slot__art img').length === 4);
  set('#reelTopH1', 'QA outfit'); set('#reelTopScale', '110'); set('#reelTopY', '3'); set('#reelFitTurn', '90');
  set('#reelMusicVol', '70'); set('#reelSfxVol', '20'); $('[data-reelsize="1440"]').click();
  $('#reelSetupBack').click(); await tick(); $('#tabStory').click(); $('#tabReel').click(); $('#btnSetup').click(); await tick();
  check('Text, fit, turn, sound and resolution survive tool switches', $('#reelTopH1').value === 'QA outfit' && $('#reelTopScale').value === '110' && $('#reelTopY').value === '3' && $('#reelFitTurn').value === '90' && $('#reelMusicVol').value === '70' && $('[data-reelsize="1440"]').getAttribute('aria-checked') === 'true');
  check('Four shots survive tool switches', !$('#btnReelGo').disabled);
  $('#reelSetupBack').click(); await tick();
  check('Closing setup releases workspace and scroll', !$('#toolWorkspace').inert && !document.body.classList.contains('is-locked'));
  return { passed: checks.length, checks };
})()
