(async () => {
  const $=s=>document.querySelector('#storyWorkspace').querySelector(s), checks=[];
  const wait=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
  const check=(name,pass)=>{if(!pass)throw Error(name);checks.push(name);};
  await wait(()=>!$('#download').disabled);
  const before=$('#profile').value;
  $('#randomProfile').click();await wait(()=>!$('#download').disabled);
  const chosen=$('#profile').value;
  check('Chooses a different user',chosen!==before);
  check('Preview username matches selection',$('canvas').getAttribute('aria-label').includes(chosen));
  const image=new Image();image.src=`stories/profiles/${chosen}.jpg`;await image.decode();
  const c=document.createElement('canvas');c.width=c.height=96;c.getContext('2d').drawImage(image,0,0);
  const expected=c.getContext('2d').getImageData(48,48,1,1).data;
  const actual=$('canvas').getContext('2d').getImageData(84,104,1,1).data;
  check('DP matches chosen username',expected.every((value,i)=>Math.abs(value-actual[i])<=1));
  $('#profileSearch').value='no-such-user';$('#profileSearch').dispatchEvent(new Event('input'));
  $('#randomProfile').click();await wait(()=>!$('#download').disabled);
  check('Clears search and restores full profile list',$('#profileSearch').value==='' && [...$('#profile').options].filter(o => o.value).length===600);
  const first=$('canvas').toDataURL();$('#addStory').click();$('#randomProfile').click();
  check('Other story remains unchanged',$('[data-story-id="1"] canvas').toDataURL()===first);
  let previous=$('#profile').value;
  for(let i=0;i<30;i++){$('#randomProfile').click();const next=$('#profile').value;if(next===previous)throw Error('Immediate repeat');previous=next;}
  check('30 rapid clicks never repeat current user',true);
  return {passed:checks.length,checks};
})()
