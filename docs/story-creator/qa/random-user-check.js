(async () => {
  // Select a SKU, finish the Drive scan and upload a review photo before running.
  const $=s=>document.querySelector('#storyWorkspace').querySelector(s), checks=[];
  const wait=async f=>{for(let i=0;i<100;i++){if(f())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
  const check=(name,pass)=>{if(!pass)throw Error(name);checks.push(name);};
  await wait(()=>!$('#download').disabled&&!$('#randomProfile').disabled&&$('#driveProduct').value);
  const users=await(await fetch('stories/profiles/users.json')).json();
  const before=$('#profile').value;
  const seen=new Set([before]);
  const remember=()=>{const username=$('#profile').value;if(!username||seen.has(username))throw Error('Session repeated a user');seen.add(username);return username;};
  $('#randomProfile').click();await wait(()=>!$('#download').disabled);
  const chosen=remember();
  check('Chooses a different user',chosen!==before);
  check('Preview username matches selection',$('canvas').getAttribute('aria-label').includes(chosen));
  const image=new Image();image.src=`stories/profiles/${users.find(user=>user.username===chosen).photo}`;await image.decode();
  const c=document.createElement('canvas');c.width=c.height=96;c.getContext('2d').drawImage(image,0,0);
  const expected=c.getContext('2d').getImageData(48,48,1,1).data;
  const actual=$('canvas').getContext('2d').getImageData(84,104,1,1).data;
  check('DP matches chosen username',expected.every((value,i)=>Math.abs(value-actual[i])<=1));
  $('#profileSearch').value='no-such-user';$('#profileSearch').dispatchEvent(new Event('input'));
  $('#randomProfile').click();await wait(()=>!$('#download').disabled);
  const firstUser=remember();
  check('Clears search and keeps at most 100 picker options',$('#profileSearch').value===''&&[...$('#profile').options].filter(o=>o.value).length<=100&&$('#profileCount').textContent.includes('6000 profiles'));
  const first=$('canvas').toDataURL();$('#addStory').click();remember();
  check('Other story remains unchanged',$('[data-story-id="1"] canvas').toDataURL()===first);
  $('#profileSearch').value=firstUser;$('#profileSearch').dispatchEvent(new Event('input'));
  check('Other draft user cannot appear in the picker',![...$('#profile').options].some(option=>option.value===firstUser));
  $('#profileSearch').value='';$('#profileSearch').dispatchEvent(new Event('input'));
  for(let i=0;i<30;i++){$('#randomProfile').click();remember();}
  check('30 rapid clicks never repeat a user drawn in this session',true);
  return {passed:checks.length,checks};
})()
