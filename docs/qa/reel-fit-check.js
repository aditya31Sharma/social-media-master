(async () => {
  const $ = s => document.querySelector(s), checks = [];
  const check = (name, ok) => { if (!ok) throw Error(name); checks.push(name); };
  const wait = async predicate => { for (let i = 0; i < 400; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 50)); } throw Error('Fit controls timed out'); };
  const set = (id, value) => { $(id).value = value; $(id).dispatchEvent(new Event('input', { bubbles: true })); };
  const pick = async (id, query, handle) => {
    $(id).focus(); set(id, query);
    const option = () => $(`${id}-options [data-handle="${handle}"]`);
    await wait(() => option() && !option().parentElement.hidden);
    option().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  };
  $('#tabReel').click(); await wait(() => /\d+ products/.test($('#prodNote').textContent));
  for (const [query, handle, scale, y, x, z] of [
    ['victor doom', 'victor-doom-polo-sweatshirt-olive', '103', '-11', '0', '1'],
    ['narcissistic', 'narcissistic-tendency-oversized-hoodie-black', '105', '-4', '0', '0'],
    ['kingdom', 'kingdom-of-northumbria-oversized-sweatshirt-white', '103', '-11', '0', '2'],
    ['money so big', 'money-so-big-baby-tee-pink', '107', '-5', '0', '0'],
    ['dark sister', 'dark-sister-oversized-henley-waffle-tee-black', '96', '-12', '1', '2'],
    ['crew oversized tee white', 'crew-oversized-tee-white', '90', '-9', '0', '2'],
  ]) {
    await pick('#topInput', query, handle);
    await wait(() => $('#reelTopScale').value === scale && $('#reelTopY').value === y);
    check(`${handle} applies size and height`, $('#reelTopScaleOut').textContent === `${scale}%` && $('#reelTopYOut').textContent === `${y}cm`);
    check(`${handle} applies position with neutral preview turn`, $('#reelTopX').value === x && $('#reelTopZ').value === z && $('#reelFitTurn').value === '0');
  }
  check('Soft studio is the default lighting', $('#reelLighting').value === 'studio');
  $('#reelLighting').value = 'contrast';
  $('#reelLighting').dispatchEvent(new Event('change', { bubbles: true }));
  set('#reelTopX', '8'); set('#reelTopZ', '12'); set('#reelTopY', '-7'); set('#reelTopScale', '94'); set('#reelFitTurn', '90');
  await pick('#botInput', 'angels motor', 'angels-motor-club-loose-fit-sweatpant-black');
  await wait(() => !$('#reelAfter').hidden);
  $('#btnSetup').click();
  const fold = $('#reelFitCv').closest('details'); fold.open = true;
  check('New position controls display centimetres', $('#reelTopXOut').textContent === '8cm' && $('#reelTopZOut').textContent === '12cm');
  $('#reelSetupBack').click(); $('#tabStory').click(); $('#tabReel').click(); $('#btnSetup').click();
  check('Bottom selection and tool switches preserve manual fit', $('#reelTopScale').value === '94' && $('#reelTopY').value === '-7' && $('#reelTopX').value === '8' && $('#reelTopZ').value === '12' && $('#reelFitTurn').value === '90');
  check('No horizontal page overflow', document.documentElement.scrollWidth <= innerWidth);
  $('#reelSetupBack').click();
  await pick('#topInput', 'california love', 'california-love-oversized-hoodie-white');
  await wait(() => $('#reelTopScale').value === '105');
  check('Choosing a new top resets its fit and inspection angle', $('#reelTopY').value === '-4' && ['#reelTopX', '#reelTopZ', '#reelFitTurn'].every(id => $(id).value === '0'));
  check('Lighting persists across garment and tool changes', $('#reelLighting').value === 'contrast');
  return { passed: checks.length, checks };
})()
