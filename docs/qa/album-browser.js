(async () => {
  const $ = s => document.querySelector(s), checks = [];
  const check = (name, value) => { if (!value) throw new Error(name); checks.push(name); };
  const wait = async predicate => { for (let i = 0; i < 300; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 30)); } throw new Error('Album update timed out'); };
  const set = (selector, value, event = 'input') => { const el = $(selector); el.value = value; el.dispatchEvent(new Event(event, { bubbles: true })); };
  $('#tabReel').click(); set('#reelTemplate', 'album', 'change'); $('#btnAlbumSetup').click();
  check('Album editor opens on the same page', !$('#albumSetup').hidden && location.hash === '#reel');
  await wait(() => !$('#albumSetup [data-generate]').disabled);
  check('Five requested SKUs preload without uploads', $('#albumSetup [data-count]').textContent === '5 / 5' && $('[data-product-name="0"]').value.includes('Stand Unshaken') && $('[data-product-name="4"]').value.includes('Northumbria'));
  check('Intro is off and opening preview starts at zero', !$('[data-intro-enabled]').checked && +$('[data-scrub]').value === 0);
  check('Product fronts are ready for all five detail views', [...document.querySelectorAll('[data-front-status]')].every(el => el.textContent === 'Front image ready'));
  const firstName = $('[data-product-name="0"]').value;
  $('[data-move="0"][data-direction="1"]').click();
  check('Product detail follows reordered model', $('[data-product-name="1"]').value === firstName);
  $('[data-move="1"][data-direction="-1"]').click();
  set('[data-duration]', '30', 'change');
  check('Duration changes the timeline', $('[data-scrub]').max === '30');
  set('[data-duration]', '45', 'change');
  async function upload(selector, file) {
    const input = $(selector), dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  for (let i = 0; i < 5; i++) {
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 480;
    const g = cv.getContext('2d'); g.fillStyle = ['#4c6240','#263548','#af6653','#574858','#b08a45'][i];
    g.beginPath(); g.arc(120, 55, 28, 0, Math.PI * 2); g.fill(); g.fillRect(60, 95, 120, 190); g.fillRect(70, 280, 40, 180); g.fillRect(130, 280, 40, 180);
    const blob = await new Promise(resolve => cv.toBlob(resolve));
    await upload(`#albumSetup [data-upload="${i}"]`, new File([blob], `model-${i}.png`, { type: 'image/png' }));
    await wait(() => !$('#albumSetup [data-generate]').disabled);
  }
  check('Five uploads enable export', !$('#albumSetup [data-generate]').disabled);
  set('#albumSetup [data-layer]', 'heading', 'change'); set('#albumSetup [data-text-text]', 'TENZEN\nANGELS');
  set('#albumSetup [data-text-size]', '86'); set('#albumSetup [data-text-spacing]', '6'); set('#albumSetup [data-text-lineHeight]', '1.3');
  set('#albumSetup [data-text-x]', '32'); $('#albumSetup [data-center-x]').click();
  check('Center button aligns the text', $('#albumSetup [data-text-x]').value === '50');
  set('#albumSetup [data-layer]', 'creator', 'change');
  check('Creator has its own text', $('#albumSetup [data-text-text]').value === 'Tenzen Angels');
  set('#albumSetup [data-layer]', 'heading', 'change');
  check('Heading styling survives label switches', $('#albumSetup [data-text-size]').value === '86' && $('#albumSetup [data-text-spacing]').value === '6');
  const font = await (await fetch('./assets/fonts/plus-jakarta-sans-latin.woff2')).blob();
  await upload('#albumSetup [data-font-upload]', new File([font], 'Test-font.woff2'));
  await wait(() => $('#albumSetup [data-font]').value.startsWith('AlbumFont'));
  check('Local font file loads into the text editor', document.fonts.check(`24px "${$('#albumSetup [data-font]').value}"`));
  set('#albumSetup [data-scrub]', '4'); const horizontal = $('#albumSetup canvas').toDataURL();
  set('#albumSetup [data-scrub]', '36'); check('Horizontal and vertical layouts differ', $('#albumSetup canvas').toDataURL() !== horizontal);
  $('#albumSetup [data-play]').click(); await new Promise(r => setTimeout(r, 250)); $('#albumSetup [data-play]').click();
  check('Timeline playback advances', +$('#albumSetup [data-scrub]').value > 36);
  $('#albumSetup [data-edit-intro]').click();
  $('#albumSetup [data-album-close]').click(); set('#reelTemplate', 'outfit', 'change');
  check('Original outfit controls remain available', !$('#outfitTemplate').hidden && !!$('#reelFitCv'));
  set('#reelTemplate', 'album', 'change'); $('#btnAlbumSetup').click();
  check('Album draft survives template switches', $('#albumSetup [data-count]').textContent === '5 / 5' && $('#albumSetup [data-text-text]').value === 'TENZEN\nANGELS');
  return { passed: checks.length, checks };
})()
