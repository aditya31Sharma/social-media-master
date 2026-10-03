(async()=>{
 const $=s=>document.querySelector(s),checks=[];
 const wait=async f=>{for(let i=0;i<800;i++){if(f())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+$('#status').textContent)};
 const check=(s,b)=>{if(!b)throw Error(s);checks.push(s)};
 $('#tabCarousel').click();await wait(()=>/\d+ products/.test($('#prodNote').textContent));
 $('#prodInput').focus();$('#prodInput').value='ACTB17';$('#prodInput').dispatchEvent(new Event('input'));
 await wait(()=>$('#prodList [data-handle]'));$('#prodList [data-handle]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
 await wait(()=>!$('#btnBuild').hidden);
 const data=new DataTransfer();data.items.add(new File([await(await fetch('./docs/story-creator/qa/figma-sample.png')).blob()],'cover.png',{type:'image/png'}));
 $('#coverFile').files=data.files;$('#coverFile').dispatchEvent(new Event('change'));
 $('#optCut').checked=false;$('#optCut').dispatchEvent(new Event('change'));
 await wait(()=>!$('#btnBuild').disabled);$('#btnBuild').click();await wait(()=>document.querySelectorAll('.tile [data-act=edit]:not([hidden])').length===6);
 check('Six output slides and caption controls',document.querySelectorAll('.tile__frame img').length===6&&!!$('[data-cap]'));
 $('[data-act=edit]').click();await wait(()=>!$('#editor').hidden&&$('[data-e-busy]').hidden);
 check('Slide starts locked',!$('[data-e-lock]').checked);
 $('[data-e-lock]').click();$('[data-e-zoom]').value='1.3';$('[data-e-zoom]').dispatchEvent(new Event('input'));
 await wait(()=>!$('[data-e-save]').disabled);$('[data-e-save]').click();await wait(()=>$('#editor').hidden);
 check('Edited slide saves and closes',!$('#toolWorkspace').inert);
 $('[data-act=edit]').click();await wait(()=>!$('#editor').hidden);check('Editor relocks on reopening',!$('[data-e-lock]').checked);$('[data-e-close]').click();
 $('[data-act=crm]').click();check('Removal requires confirmation',$('#removeCarouselDialog').open);
 $('#removeCarouselDialog [data-close-dialog]').click();check('Cancel preserves carousel',document.querySelectorAll('.cara').length===1);
 $('[data-cap]').value='Draft caption';$('[data-cap]').dispatchEvent(new Event('input'));$('#tabStory').click();$('#tabCarousel').click();check('Carousel and caption retained across tools',$('[data-cap]').value==='Draft caption'&&document.querySelectorAll('.tile').length===6);
 return{passed:checks.length,checks};
})()
