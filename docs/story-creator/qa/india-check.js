(async()=>{
 const $=s=>document.querySelector('#storyWorkspace').querySelector(s),checks=[];
 const check=(name,pass)=>{if(!pass)throw Error(name);checks.push(name);};
 const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
 await wait(()=>!$('#randomProfile').disabled);
 const users=await(await fetch('stories/profiles/users.json')).json();
 check('600 profiles in data and picker',users.length===600&&$('#profile').options.length===600);
 check('600 unique usernames',new Set(users.map(u=>u.username.toLowerCase())).size===600);
 let next=0,decoded=0;const failures=[];
 await Promise.all(Array.from({length:12},async()=>{
  while(next<users.length){const user=users[next++],img=new Image();img.src=`stories/profiles/${user.photo}`;
   try{await img.decode();if(img.naturalWidth<32||img.naturalHeight<32||Math.max(img.naturalWidth,img.naturalHeight)>96)throw Error('Unexpected dimensions');decoded++;}catch{failures.push(user.username);}
  }
 }));
 check('Every DP decodes at expected dimensions',decoded===600&&failures.length===0);
 const random=Math.random;
 try{Math.random=()=>.999999;$('#randomProfile').click();}finally{Math.random=random;}
 check('Randomizer reaches new Indian accounts',$('#profile').value===users[599].username);
 check('Preview reflects new selected username',$('canvas').getAttribute('aria-label').includes(users[599].username));
 $('#profileSearch').value=users[100].username;$('#profileSearch').dispatchEvent(new Event('input'));
 check('First new Indian account is searchable',[...$('#profile').options].some(o=>o.value===users[100].username));
 $('#profileSearch').value='';$('#profileSearch').dispatchEvent(new Event('input'));
 check('All600 profiles restored after search',$('#profile').options.length===600&&$('#profileCount').textContent==='600 of 600 profiles');
 return{passed:checks.length,decoded,failures,checks};
})()
