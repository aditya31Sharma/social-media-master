(async()=>{
 const $=s=>document.querySelector(s),checks=[];
 const check=(name,pass)=>{if(!pass)throw Error(name);checks.push(name);};
 const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
 const input=(selector,value,event='input')=>{$(selector).value=value;$(selector).dispatchEvent(new Event(event,{bubbles:true}));};
 const red=(id,x)=>$(`[data-story-id="${id}"] canvas`).getContext('2d').getImageData(x,26,1,1).data[0];
 await wait(()=>!$('#download').disabled);
 input('#progress','0');check('0% has no white fill',red(1,30)<200&&red(1,1050)<200);
 input('#progress','100');check('100% fills entire track',red(1,30)>245&&red(1,1050)>245);
 input('#progressValue','50');check('50% fills left half only',red(1,500)>245&&red(1,600)<200&&$('#progress').value==='50');
 input('#progressValue','140','change');check('Manual values clamp at100',$('#progressValue').value==='100');
 input('#progressValue','-5','change');check('Manual values clamp at0',$('#progressValue').value==='0');
 const random=Math.random;
 try{Math.random=()=>0;$('#randomProgress').click();check('Randomizer includes0',$('#progress').value==='0');Math.random=()=>.999999;$('#randomProgress').click();check('Randomizer includes100',$('#progress').value==='100');}finally{Math.random=random;}
 for(let i=0;i<200;i++){$('#randomProgress').click();const v=Number($('#progress').value);if(v<0||v>100||!Number.isInteger(v))throw Error('Random out of bounds');}
 check('200 randomized values stay within0-100',true);
 input('#progress','25');const first=$('canvas').toDataURL();$('#addStory').click();input('#progress','75');
 check('Second story progress does not change first',$('[data-story-id="1"] canvas').toDataURL()===first);
 $('[data-story-id="1"] .story-select').click();check('Selecting first restores25%',$('#progress').value==='25'&&$('#progressValue').value==='25');
 $('[data-story-id="2"] .story-select').click();check('Selecting second restores75%',$('#progress').value==='75'&&$('#progressValue').value==='75');
 $('[data-story-id="1"] .story-select').click();
 const original=HTMLAnchorElement.prototype.click;let url;
 try{HTMLAnchorElement.prototype.click=function(){url=this.href;};$('#download').click();await wait(()=>url);const bitmap=await createImageBitmap(await(await fetch(url)).blob());const out=document.createElement('canvas');out.width=bitmap.width;out.height=bitmap.height;out.getContext('2d').drawImage(bitmap,0,0);const ctx=out.getContext('2d');check('Export retains25% progress fill',ctx.getImageData(100,26,1,1).data[0]>220&&ctx.getImageData(540,26,1,1).data[0]<200);bitmap.close();}finally{HTMLAnchorElement.prototype.click=original;}
 return{passed:checks.length,checks};
})()
