(async () => {
  const $ = selector => document.querySelector(selector), checks = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); checks.push(name); };
  const pause = () => new Promise(resolve => setTimeout(resolve, 250));
  const data = new DataTransfer();
  data.items.add(new File([await (await fetch('./docs/story-creator/qa/figma-sample.png')).blob()], 'paste-owner.png', { type: 'image/png' }));
  const paste = (target = window) => target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  $('#tabStory').click();
  const coverBefore = $('#coverName').textContent;
  paste(); await pause();
  check('Story paste leaves Carousel cover alone', $('#photoName').textContent === 'paste-owner.png' && $('#coverName').textContent === coverBefore);
  const story = $('.story-canvas'), frame = story.toDataURL();
  $('#tabCarousel').click(); paste(); await pause();
  check('Carousel paste leaves Story pixels alone', $('#coverName').textContent === 'paste-owner.png' && story.toDataURL() === frame);
  data.items.clear(); data.items.add(new File([await (await fetch('./docs/story-creator/qa/figma-sample.png')).blob()], 'must-ignore.png', { type: 'image/png' }));
  paste($('#prodInput')); await pause();
  check('Pasting into a text field does not replace a photo', $('#coverName').textContent === 'paste-owner.png');
  $('#tabReel').click(); paste(); await pause();
  check('Reel paste changes neither other tool', $('#coverName').textContent === 'paste-owner.png' && story.toDataURL() === frame);
  const origin = performance.timeOrigin;
  history.back(); await pause();
  check('Browser Back restores tool without reload', document.body.dataset.tool === 'carousel' && performance.timeOrigin === origin);
  history.forward(); await pause();
  check('Browser Forward restores tool without reload', document.body.dataset.tool === 'reel' && performance.timeOrigin === origin);
  $('#tabStory').click();
  return { passed: checks.length, checks };
})()
