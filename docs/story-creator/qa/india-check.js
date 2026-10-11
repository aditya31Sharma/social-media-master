(async()=>{
 const checks=[];
 const check=(name,pass)=>{if(!pass)throw Error(name);checks.push(name);};
 const users=await(await fetch('stories/profiles/users.json')).json();
 const india=await(await fetch('docs/story-creator/data/instagram_users_india.json')).json();
 check('6000 profiles in the local dataset',users.length===6000);
 check('6000 unique usernames',new Set(users.map(u=>u.username.toLowerCase())).size===6000);
 check('Original 500 India profiles retain their order',india.users.length===500&&india.users.every((user,index)=>users[index+100].username===user.username));
 let next=0,decoded=0;const failures=[];
 await Promise.all(Array.from({length:12},async()=>{
  while(next<users.length){const user=users[next++],img=new Image();img.src=`stories/profiles/${user.photo}`;
   try{await img.decode();if(img.naturalWidth<32||img.naturalHeight<32||Math.max(img.naturalWidth,img.naturalHeight)>96)throw Error('Unexpected dimensions');decoded++;}catch{failures.push(user.username);}
  }
 }));
 check('Every DP decodes at expected dimensions',decoded===users.length&&failures.length===0);
 return{passed:checks.length,decoded,failures,checks};
})()
