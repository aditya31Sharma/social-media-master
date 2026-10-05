import { labelRect } from './album-render.js';
import { snapCenter } from './album-text.js';
import { artworkRect } from './album-v2-brand.js';
import { moveEnding } from './album-v2-ending.js';

export function wireCanvasEditor(canvas, { state, introInspector, outroInspector, endingLayout, changed }) {
  let drag = null, guides = {};
  const active = () => canvas.dataset.edit === 'true' && canvas.dataset.busy !== 'true';
  const context = () => canvas.dataset.section === 'intro' ? { data: state, inspector: introInspector, section:'intro' } : { data: state.ending, inspector: outroInspector, section:'outro' };
  const point = event => { const r = canvas.getBoundingClientRect(); return { x:(event.clientX-r.left)/r.width*1080, y:(event.clientY-r.top)/r.height*1920, r }; };
  function layers() {
    const {data,section} = context(), result = data.labels.map(value => ({ id:value.id, type:'text', value, rect:()=>labelRect(canvas.getContext('2d'),value) }));
    for (const id of ['brand','link']) if (data[id]) result.push({id,type:'artwork',value:data[id],rect:()=>artworkRect(data[id])});
    if (section === 'outro') {
      const models = endingLayout()?.models;
      if (models?.length) {
        const first = models[0], last = models.at(-1), value = { get x(){return data.x/100;},set x(n){moveEnding(data,'x',n*100);},get y(){return data.y/100;},set y(n){moveEnding(data,'y',n*100);} };
        result.unshift({id:'models',type:'models',value,rect:()=>({x:first.x,y:first.y,w:last.x+last.width-first.x,h:first.height})});
      }
    }
    return result;
  }
  const selected = () => layers().find(layer=>layer.id === context().inspector.selected.id);
  const visible = layer => layer.value.enabled !== false && (layer.type !== 'text' || !!layer.value.text);
  const corners = rect => [[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x,rect.y+rect.h],[rect.x+rect.w,rect.y+rect.h]];
  function resizeHit(layer,p) { return layer && layer.type !== 'models' && visible(layer) && corners(layer.rect()).some(([x,y])=>Math.hypot(p.x-x,p.y-y)<12*1080/p.r.width); }
  canvas.addEventListener('pointerdown', event => {
    if (!active() || event.button > 0) return;
    const p = point(event), current = selected(), resize = resizeHit(current,p);
    const hit = resize ? current : layers().reverse().find(layer => { if(!visible(layer))return false; const r=layer.rect(), pad=8*1080/p.r.width; return p.x>=r.x-pad && p.x<=r.x+r.w+pad && p.y>=r.y-pad && p.y<=r.y+r.h+pad; });
    if (!hit) return;
    context().inspector.select(hit.id,false); event.preventDefault(); canvas.focus({preventScroll:true}); canvas.setPointerCapture(event.pointerId);
    const rect=hit.rect(); drag={layer:hit,resize,start:p,x:hit.value.x,y:hit.value.y,rect,size:hit.type==='text'?hit.value.size:hit.value.scale}; changed(context().section);
  });
  canvas.addEventListener('pointermove', event => {
    if (!active()) return;
    const p=point(event);
    if (!drag) { canvas.style.cursor=resizeHit(selected(),p)?'nwse-resize':'move'; return; }
    if (drag.resize) {
      const center={x:drag.rect.x+drag.rect.w/2,y:drag.rect.y+drag.rect.h/2};
      const factor=Math.max(Math.abs(p.x-center.x)/(drag.rect.w/2),Math.abs(p.y-center.y)/(drag.rect.h/2));
      if(drag.layer.type==='text')drag.layer.value.size=Math.max(8,Math.min(240,Math.round(drag.size*factor)));
      else drag.layer.value.scale=Math.max(.05,Math.min(2,drag.size*factor));
    } else {
      const x=drag.x+(p.x-drag.start.x)/1080,y=drag.y+(p.y-drag.start.y)/1920;
      drag.layer.value.x=Math.max(0,Math.min(1,event.altKey?x:snapCenter(x,p.r.width)));
      drag.layer.value.y=Math.max(0,Math.min(1,event.altKey?y:snapCenter(y,p.r.height)));
      guides={x:drag.layer.value.x===.5,y:drag.layer.value.y===.5};
    }
    changed(context().section);
  });
  const release=()=>{if(!drag)return;drag=null;guides={};changed(context().section);};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('keydown',event=>{
    if(!active()||!event.key.startsWith('Arrow'))return;
    event.preventDefault();const layer=selected(),amount=event.shiftKey?10:1;if(!layer)return;
    if(event.key==='ArrowLeft')layer.value.x=Math.max(0,layer.value.x-amount/1080);
    if(event.key==='ArrowRight')layer.value.x=Math.min(1,layer.value.x+amount/1080);
    if(event.key==='ArrowUp')layer.value.y=Math.max(0,layer.value.y-amount/1920);
    if(event.key==='ArrowDown')layer.value.y=Math.min(1,layer.value.y+amount/1920);
    changed(context().section);
  });
  return { drawGuides() {
    if(!active())return;const layer=selected();if(!layer||!visible(layer))return;
    const rect=layer.rect(),ctx=canvas.getContext('2d'),pixel=1080/canvas.getBoundingClientRect().width;
    ctx.save();ctx.setTransform(canvas.width/1080,0,0,canvas.height/1920,0,0);ctx.strokeStyle='#8b5cf6';ctx.fillStyle='#fff';ctx.lineWidth=pixel;
    ctx.strokeRect(rect.x,rect.y,rect.w,rect.h);
    if(layer.type!=='models')for(const[x,y]of corners(rect)){ctx.fillRect(x-3*pixel,y-3*pixel,6*pixel,6*pixel);ctx.strokeRect(x-3*pixel,y-3*pixel,6*pixel,6*pixel);}
    ctx.beginPath();if(guides.x){ctx.moveTo(540,0);ctx.lineTo(540,1920);}if(guides.y){ctx.moveTo(0,960);ctx.lineTo(1080,960);}ctx.stroke();ctx.restore();
  }};
}
