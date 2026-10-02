(async () => {
  const $ = s => document.querySelector(s), checks = [];
  const assert = (name, ok) => { checks.push({name, pass:!!ok}); if (!ok) throw new Error(name); };
  const wait = async predicate => {
    for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 20)); }
    throw new Error('Timed out');
  };
  const colored = pixel => Math.max(...pixel.slice(0,3)) - Math.min(...pixel.slice(0,3)) > 30;
  const input = (s, value, event='input') => { $(s).value=value; $(s).dispatchEvent(new Event(event,{bubbles:true})); };
  const card = id => $(`[data-story-id="${id}"]`);
  const canvas = id => card(id).querySelector('canvas');
  const makeImage = async (width,height,name) => {
    const c=document.createElement('canvas'); c.width=width;c.height=height;
    const x=c.getContext('2d');x.fillStyle='rgb(240,80,40)';x.fillRect(0,0,width,height);
    x.fillStyle='rgb(40,160,100)';x.fillRect(width*.4,height*.4,width*.2,height*.2);
    return new File([await new Promise(r=>c.toBlob(r))],name,{type:'image/png'});
  };
  const paste = async file => {
    const data=new DataTransfer();data.items.add(file);
    window.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data}));
    await wait(()=>$('#photoName').textContent===file.name && !$('#download').disabled);
  };
  await wait(()=>!$('#addStory').disabled);
  assert('Initial blank story cannot download', $('#download').disabled && $('#downloadAll').disabled);
  for (const [w,h] of [[1600,900],[900,1600],[1000,1000],[4000,300],[300,4000]]) {
    await paste(await makeImage(w,h,`shape-${w}-${h}.png`));
    const ctx=canvas(1).getContext('2d');
    assert(`Photo covers top and edges for ${w}x${h}`, [[0,5],[1079,5],[0,900],[1079,900],[0,1919],[1079,1919]].every(([x,y])=>colored(ctx.getImageData(x,y,1,1).data)));
  }
  input('#zoom','0.2');assert('Zoom cannot fall below cover',Number($('#zoom').value)===1);
  const area=card(1).querySelector('.photo-area');
  for(let i=0;i<100;i++) area.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',shiftKey:true,bubbles:true}));
  assert('Extreme dragging leaves no empty edge',colored(canvas(1).getContext('2d').getImageData(0,1919,1,1).data));
  input('#photoRatio','landscape','change');
  assert('Landscape container exactly 16:9 and starts at top',Math.abs(area.clientWidth/area.getBoundingClientRect().height-16/9)<.015 && area.style.top==='0%');
  assert('Landscape photo reaches both edges',colored(canvas(1).getContext('2d').getImageData(1079,600,1,1).data));
  input('#photoRatio','portrait','change');$('#resetPhoto').click();
  input('#timeValue','7','change');
  const first=canvas(1).toDataURL();
  $('#addStory').click();await wait(()=>document.querySelectorAll('.story-card').length===2);
  assert('New story added on right',card(2).offsetLeft>card(1).offsetLeft);
  assert('New story starts empty',!card(2).querySelector('.empty-photo').hidden && $('#download').disabled);
  await paste(await makeImage(1600,900,'story-two.png'));
  input('#timeValue','12','change');document.querySelector('[data-unit=h]').click();
  input('#profileSearch','danax');await wait(()=>!$('#download').disabled);
  input('#format','1920','change');
  assert('Second story has its own time and profile',canvas(2).getAttribute('aria-label').includes('danaxbarghouti, 12 hours'));
  assert('First story pixels stay unchanged',canvas(1).toDataURL()===first);
  card(1).querySelector('.story-select').click();
  assert('Selecting restores independent controls',$('#timeValue').value==='7' && $('#format').value==='2150' && document.querySelector('[data-unit=m]').getAttribute('aria-pressed')==='true');
  const original=HTMLAnchorElement.prototype.click, exports=[];
  try {
    HTMLAnchorElement.prototype.click=function(){exports.push({url:this.href,name:this.download});};
    card(2).querySelector('.story-save').click();await wait(()=>exports.length===1 && !$('#downloadAll').disabled);
    assert('Individual card exports its own story',exports[0].name==='story-2-danaxbarghouti-12h.webp');
    exports.length=0;$('#downloadAll').click();await wait(()=>exports.length===2 && !$('#downloadAll').disabled);
    assert('Bulk export produces exactly two distinct files',new Set(exports.map(e=>e.name)).size===2);
    for(let i=0;i<exports.length;i++) {
      const blob=await(await fetch(exports[i].url)).blob(), bytes=new Uint8Array(await blob.arrayBuffer());
      assert(`Story ${i+1} is actual WebP`,blob.type==='image/webp' && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP');
      const bitmap=await createImageBitmap(blob);assert(`Story ${i+1} preserves its export dimensions`,bitmap.width===1080 && bitmap.height===(i===0?2150:1920));bitmap.close();
    }
    $('#addStory').click();exports.length=0;$('#downloadAll').click();
    await wait(()=>exports.length===2 && !$('#downloadAll').disabled);
    assert('Bulk export reports unfinished story',$('#status').textContent.includes('1 unfinished story skipped'));
  } finally {HTMLAnchorElement.prototype.click=original;}
  return {passed:checks.length,checks};
})()
