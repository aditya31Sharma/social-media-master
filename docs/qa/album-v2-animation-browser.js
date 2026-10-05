(async () => {
  const $ = selector => document.querySelector(selector), checks = [];
  const check = (name, ok) => { if (!ok) throw Error(name); checks.push(name); };
  const wait = async predicate => { for (let i=0;i<3000;i++) { if(predicate())return; await new Promise(resolve=>setTimeout(resolve,30)); } throw Error('Animation editor did not settle'); };
  const set = (key,value) => { const input=$(`#v2OutroEditor [data-animation="${key}"]`); input.value=value; input.dispatchEvent(new Event('input',{bubbles:true})); };
  const select = id => $(`#v2-panel-2 [data-layer-id="${id}"]`).click();
  $('#tabReel').click(); $('#reelTemplate').value='album-v2'; $('#reelTemplate').dispatchEvent(new Event('change')); $('#btnAlbumV2Setup').click();
  await wait(()=>!$('[data-v2-generate]').disabled); $('#v2-tab-2').click();
  check('Approved animation is the default', $('[data-animation="style"]').value==='scale-out' && $('[data-animation="duration"]').value==='0.38' && $('[data-animation="scaleOut"]').value==='145');
  check('Eight entrance options are available', $('[data-animation="style"]').options.length===8);
  check('Duration uses a draggable slider', !!$('[data-animation="duration"]').parentElement.querySelector('input[type=range]'));
  for(const style of ['scale-in','scale-out','fade-in','instant','slide-left','slide-right','slide-top','slide-bottom']) {
    set('style',style); check(`${style} selects and exposes relevant controls`, $('[data-animation="style"]').value===style && $('[data-animation="duration"]').parentElement.hidden===(style==='instant'));
  }
  set('duration','1.4');set('delay','.5');set('easing','linear');
  check('Long animation extends the reel instead of clipping', Math.abs(+$('[data-v2-scrub]').max-42.75)<1e-9);
  select('brand');check('Different layers keep separate animations', $('[data-animation="style"]').value==='scale-out');
  select('heading');check('Animation settings persist when switching layers', $('[data-animation="style"]').value==='slide-bottom' && $('[data-animation="duration"]').value==='1.4');
  $('[data-animation-all]').click();select('link');check('Apply all includes the globe SVG', $('[data-animation="style"]').value==='slide-bottom' && $('[data-animation="delay"]').value==='0.5');
  $('[data-animation-preview]').click();await new Promise(resolve=>setTimeout(resolve,150));
  check('Preview plays only the ending entrance', +$('[data-v2-scrub]').value>40 && +$('[data-v2-scrub]').value<41 && $('[data-v2-play]').textContent==='Pause');
  $('[data-v2-play]').click();select('models');check('Model spacing controls remain separate', $('#v2OutroEditor .v2-animation').hidden);
  select('heading');set('style','scale-out');set('duration','.38');set('delay','0');set('easing','snappy');$('[data-animation-all]').click();
  check('Default settings restore41.8seconds', +$('[data-v2-scrub]').max===41.8);
  $('[data-v2-close]').click();return {passed:checks.length,checks};
})()
