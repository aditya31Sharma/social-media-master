import { clipRange } from './intro-timing.js';
export function introTimelineControls() {
  return `<section class="editor-group" data-intro-timeline><h3>Choose a section</h3>
    <div class="intro-filmstrip"><canvas width="800" height="64" data-intro-filmstrip aria-label="Source video timeline. Drag the selected section."></canvas><div data-intro-selection></div>
      <input type="range" data-intro-bound="start" aria-label="Intro clip start" min="0" step=".01"><input type="range" data-intro-bound="end" aria-label="Intro clip end" min="0" step=".01"></div>
    <div class="editor-time-fields">${['start','end'].map(key=>`<label class="field"><span>${key==='start'?'In':'Out'} · seconds</span><input class="input" type="text" inputmode="decimal" data-intro-time="${key}" aria-label="Intro ${key} seconds"></label>`).join('')}<output data-intro-length></output></div>
    <label class="field"><span>Source preview <output data-intro-source-time>0.00s</output></span><input type="range" data-intro-source min="0" step=".01" aria-label="Preview source video time"></label>
    <div class="album-button-row"><button type="button" class="btn" data-intro-preview>Play selection</button><button type="button" class="btn" data-intro-trim-reset>Reset trim</button></div></section>
    <label class="field" data-intro-still hidden><span>Image duration <output data-intro-still-value>3.5s</output></span><input type="range" data-intro-still-duration min=".5" max="30" step=".1" value="3.5" aria-label="Intro image duration"></label>`;
}
export function wireIntroTimeline(root, { state, changed, preview, play }) {
  const $=s=>root.querySelector(s), film=$('[data-intro-filmstrip]'), selection=$('[data-intro-selection]');
  let source=null, thumbnail=null, generation=0, drag=null;
  const usable=()=>!!state.intro && state.intro.kind!=='image' && !root.querySelector('.album-controls').disabled;
  async function thumbnails(intro, token) {
    thumbnail?.pause(); if(thumbnail){thumbnail.removeAttribute('src');thumbnail.load();}
    const video=document.createElement('video');thumbnail=video;video.muted=true;video.playsInline=true;video.preload='auto';
    const wait=(event,action)=>new Promise((resolve,reject)=>{
      const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Timeline unavailable'));};
      const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,done);video.removeEventListener('error',fail);};
      const timer=setTimeout(fail,6000);video.addEventListener(event,done,{once:true});video.addEventListener('error',fail,{once:true});action();
    });
    try {
      await wait('loadeddata',()=>{video.src=intro.video.src;});
      const ctx=film.getContext('2d');ctx.clearRect(0,0,film.width,film.height);
      for(let i=0;i<8;i++){
        if(token!==generation)return;
        await wait('seeked',()=>{video.currentTime=Math.min(intro.duration-.04,(i+.5)*intro.duration/8);});
        if(token!==generation)return;
        const w=film.width/8,h=film.height,scale=Math.max(w/video.videoWidth,h/video.videoHeight),sw=w/scale,sh=h/scale;
        ctx.drawImage(video,(video.videoWidth-sw)/2,(video.videoHeight-sh)/2,sw,sh,i*w,0,w,h);
      }
    } catch { if(token===generation)film.setAttribute('aria-label','Video timeline. Use In and Out to select a section.'); }
    finally {video.pause();video.removeAttribute('src');video.load();if(thumbnail===video)thumbnail=null;}
  }
  function sync() {
    const intro=state.intro, image=intro?.kind==='image';
    $('[data-intro-timeline]').hidden=!intro||image;$('[data-intro-still]').hidden=!image;
    $('[data-intro-still-duration]').value=state.introStillDuration;$('[data-intro-still-value]').textContent=`${state.introStillDuration.toFixed(1)}s`;
    if(intro!==source){source=intro;generation++;if(intro&&!image)void thumbnails(intro,generation);}
    if(!intro||image)return;
    state.introRange=clipRange(intro.duration,state.introRange);const range=state.introRange;
    for(const key of ['start','end']){
      const slider=$(`[data-intro-bound="${key}"]`);slider.max=intro.duration;slider.value=range[key];
      $(`[data-intro-time="${key}"]`).value=range[key].toFixed(2);
    }
    selection.style.left=`${range.start/intro.duration*100}%`;selection.style.width=`${(range.end-range.start)/intro.duration*100}%`;
    $('[data-intro-length]').textContent=`${(range.end-range.start).toFixed(2)}s selected`;$('[data-intro-source]').max=intro.duration;
  }
  function apply(key,value) {
    if(!usable()||!Number.isFinite(value)){sync();return;}
    const range=clipRange(state.intro.duration,state.introRange), min=Math.min(.1,state.intro.duration);
    if(key==='start')range.start=Math.max(0,Math.min(range.end-min,value));
    else range.end=Math.min(state.intro.duration,Math.max(range.start+min,value));
    state.introRange=range;changed();sync();preview(key==='start'?range.start:Math.max(range.start,range.end-1/30));
  }
  for(const key of ['start','end']){
    $(`[data-intro-bound="${key}"]`).addEventListener('input',event=>apply(key,+event.target.value));
    $(`[data-intro-time="${key}"]`).addEventListener('change',event=>apply(key,event.target.value.trim()?+event.target.value:NaN));
  }
  $('[data-intro-source]').addEventListener('input',event=>{if(usable())preview(+event.target.value);});
  $('[data-intro-preview]').addEventListener('click',()=>{if(usable())play();});
  $('[data-intro-trim-reset]').addEventListener('click',()=>{if(!usable())return;state.introRange=clipRange(state.intro.duration);changed();sync();});
  $('[data-intro-still-duration]').addEventListener('input',event=>{state.introStillDuration=+event.target.value;changed();sync();});
  film.addEventListener('pointerdown',event=>{
    if(!usable()||event.button>0)return;const range=state.introRange,r=film.getBoundingClientRect();
    drag={x:event.clientX,start:range.start,length:range.end-range.start,width:r.width};film.setPointerCapture(event.pointerId);event.preventDefault();
  });
  film.addEventListener('pointermove',event=>{
    if(!drag||!usable())return;
    const start=Math.max(0,Math.min(state.intro.duration-drag.length,drag.start+(event.clientX-drag.x)/drag.width*state.intro.duration));
    state.introRange={start,end:start+drag.length};changed();sync();preview(start);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])film.addEventListener(event,()=>{drag=null;});
  return {sync,showTime(time){if(!Number.isFinite(time))return;$('[data-intro-source]').value=time;$('[data-intro-source-time]').textContent=`${time.toFixed(2)}s`;} };
}
