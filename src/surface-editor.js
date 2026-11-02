import { WallpaperRenderer } from './renderer.js';
import { LIMITS, aspectRatio, sanitizeRecipe } from './model.js';

const PATTERNS=[['ribbons','≋','Flowing ribbons'],['pools','◎','Radial pools'],['vortex','◉','Liquid vortex'],['interference','⌘','Interference']];
const CONTROLS=[['flow','Flow amount','%'],['scale','Pattern scale','%'],['tilt','Direction','°'],['warpScale','Flow complexity','%'],['turbulence','Turbulence','%'],['stretch','Stretch','%'],['position','Band offset','%'],['phase','Animation phase',' rad']];
const clone=value=>JSON.parse(JSON.stringify(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Direct manipulation edits the same serializable recipe as the main studio. */
export class SurfaceEditor {
  constructor({getRecipe,onChange,onError}) {
    this.getRecipe=getRecipe;this.onChange=onChange;this.onError=onError;
    this.selected=-1;this.addMode=false;this.history=[];this.cursor=0;this.frame=0;
    this.dialog=document.createElement('dialog');this.dialog.id='surface-designer';
    this.dialog.setAttribute('aria-labelledby','designer-title');
    this.dialog.innerHTML=`
      <div class="designer-heading"><div><p class="eyebrow">THE SURFACE DESIGNER</p><h2 id="designer-title">Give the liquid a direction<span>.</span></h2><p>Pick a pattern. Add bend points. Pull the material into shape.</p></div><button class="icon-button designer-close" aria-label="Close surface designer"><svg><use href="#i-close"/></svg></button></div>
      <div class="designer-body"><section class="designer-art" aria-label="Interactive surface editor"><div class="designer-toolbar"><div><button id="add-bend" class="button">+ Add bend point</button><span id="point-count">0 / 6 points</span></div><div class="designer-history"><button id="surface-undo" class="icon-button" aria-label="Undo surface edit" title="Undo">↶</button><button id="surface-redo" class="icon-button" aria-label="Redo surface edit" title="Redo">↷</button></div></div><div class="designer-canvas-area"><div id="designer-frame"><canvas id="designer-canvas" aria-label="Continuous liquid surface with draggable bend points"></canvas><div id="designer-handles"></div><div id="influence-ring" hidden></div></div></div><p id="designer-hint" class="designer-hint">Drag the crosshair to move the pattern. Add a point, then drag it to bend the liquid.</p><div class="designer-bottom"><span>CONTINUOUS SURFACE · YOUR SLITS ARE KEPT</span><button id="clear-bends" class="inline-button">Reset bends</button></div></section>
      <aside class="designer-settings" aria-label="Surface design settings"><div class="section-label">01 <span>PATTERN FAMILY</span></div><div class="pattern-choices">${PATTERNS.map(([id,icon,name])=>`<button data-pattern="${id}" aria-pressed="false"><span aria-hidden="true">${icon}</span>${name}</button>`).join('')}</div><div class="section-label">02 <span>FLOW & STRUCTURE</span></div>${CONTROLS.map(([key,label,unit])=>`<div class="slider-control"><label class="slider-label" for="design-${key}">${label}<output id="design-output-${key}"></output></label><input id="design-${key}" data-design-setting="${key}" type="range" min="${key==='phase'?0:LIMITS[key][0]}" max="${key==='phase'?Math.PI*2:LIMITS[key][1]}" step="${key==='phase'?.01:1}" aria-label="${label}" data-unit="${unit}"></div>`).join('')}<div class="section-label">03 <span id="selected-point-title">BEND POINT</span></div><div id="point-details" hidden><div class="slider-control"><label class="slider-label" for="point-radius">Influence radius<output id="point-radius-output"></output></label><input type="range" id="point-radius" min="5" max="150" value="30" aria-label="Bend influence radius"></div><div class="slider-control"><label class="slider-label" for="point-strength">Pull strength<output id="point-strength-output"></output></label><input type="range" id="point-strength" min="0" max="200" value="100" aria-label="Bend pull strength"></div><button id="remove-bend" class="remove-bend">Remove selected point</button></div><p id="point-empty" class="point-empty">Add a point on the surface, then drag it. Each point pulls a local part of the pattern. Up to six points can work together.</p></aside></div>
      <div class="designer-footer"><span>Changes appear in your wallpaper as you edit. Undo is available here.</span><button class="button button-dark" id="designer-done">Back to the studio <svg><use href="#i-arrow"/></svg></button></div>`;
    document.body.append(this.dialog);
    this.$=selector=>this.dialog.querySelector(selector);
    this.$$=selector=>[...this.dialog.querySelectorAll(selector)];
    this.$('.designer-close').addEventListener('click',()=>this.close());
    this.$('#designer-done').addEventListener('click',()=>this.close());
    this.dialog.addEventListener('close',()=>{this.addMode=false;this.renderTarget?.dispose();this.renderTarget=null;cancelAnimationFrame(this.frame);this.frame=0;});
    this.dialog.addEventListener('cancel',()=>this.addMode=false);
    this.$('#add-bend').addEventListener('click',()=>{this.addMode=!this.addMode;this.sync();});
    this.$('#clear-bends').addEventListener('click',()=>{this.selected=-1;this.apply({points:[]});});
    this.$('#remove-bend').addEventListener('click',()=>{const points=clone(this.getRecipe().points);points.splice(this.selected,1);this.selected=-1;this.apply({points});});
    this.$('#surface-undo').addEventListener('click',()=>this.restore(-1));
    this.$('#surface-redo').addEventListener('click',()=>this.restore(1));
    this.$$('[data-pattern]').forEach(button=>button.addEventListener('click',()=>this.apply({pattern:button.dataset.pattern})));
    this.$$('[data-design-setting]').forEach(input=>{
      input.addEventListener('input',()=>this.apply({[input.dataset.designSetting]:Number(input.value)},{commit:false}));
      input.addEventListener('change',()=>this.commit());
    });
    for(const [selector,key] of [['#point-radius','radius'],['#point-strength','strength']]) {
      const input=this.$(selector);
      input.addEventListener('input',()=>{if(this.selected<0)return;const points=clone(this.getRecipe().points);points[this.selected][key]=Number(input.value)/100;this.apply({points},{commit:false});});
      input.addEventListener('change',()=>this.commit());
    }
    const frame=this.$('#designer-frame');
    frame.addEventListener('pointerdown',event=>this.pointerDown(event));
    frame.addEventListener('pointermove',event=>this.pointerMove(event));
    frame.addEventListener('pointerup',()=>{if(this.dragging!==undefined&&this.dragging!==null){this.dragging=null;this.commit();}});
    frame.addEventListener('pointercancel',()=>{this.dragging=null;this.commit();});
    frame.addEventListener('keydown',event=>this.handleKey(event));
    this.dialog.addEventListener('keydown',event=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();this.restore(event.shiftKey?1:-1);}
    });
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(this.$('.designer-canvas-area'));
  }
  open() {
    this.history=[clone(this.getRecipe())];this.cursor=0;this.selected=-1;this.addMode=false;this.dialog.showModal();
    const previous=this.$('#designer-canvas');previous.replaceWith(previous.cloneNode(false));
    try{this.renderTarget=new WallpaperRenderer(this.$('#designer-canvas'));this.sync();this.resize();}
    catch(error){this.onError(error.message);this.dialog.close();}
  }
  close() {this.dialog.close();}
  apply(patch,{commit=true}={}) {this.onChange(patch);this.sync();this.render();if(commit)this.commit();}
  commit() {
    const snapshot=clone(this.getRecipe());
    if(JSON.stringify(snapshot)!==JSON.stringify(this.history[this.cursor])){
      this.history=this.history.slice(0,this.cursor+1);this.history.push(snapshot);
      if(this.history.length>50)this.history.shift();this.cursor=this.history.length-1;
    }
    this.updateHistoryButtons();
  }
  restore(delta) {
    const next=this.cursor+delta;if(next<0||next>=this.history.length)return;
    this.cursor=next;this.selected=-1;this.onChange(sanitizeRecipe(this.history[next]));this.sync();this.resize();
  }
  updateHistoryButtons() {this.$('#surface-undo').disabled=this.cursor<=0;this.$('#surface-redo').disabled=this.cursor>=this.history.length-1;}
  sync() {
    const recipe=this.getRecipe();
    this.$$('[data-pattern]').forEach(button=>{const selected=button.dataset.pattern===recipe.pattern;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});
    this.$$('[data-design-setting]').forEach(input=>{const key=input.dataset.designSetting;if(key==='phase'){input.min=Math.min(0,Math.floor(recipe.phase/(Math.PI*2))*Math.PI*2);input.max=Math.max(Math.PI*2,Math.ceil(recipe.phase/(Math.PI*2))*Math.PI*2);}input.value=recipe[key];input.style.setProperty('--progress',((recipe[key]-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');this.$('#design-output-'+key).textContent=(key==='phase'?recipe[key].toFixed(2):recipe[key])+input.dataset.unit;});
    const add=this.$('#add-bend');add.classList.toggle('armed',this.addMode);add.disabled=recipe.points.length>=6;add.textContent=this.addMode?'Click on the surface…':'+ Add bend point';add.setAttribute('aria-pressed',String(this.addMode));
    this.$('#point-count').textContent=`${recipe.points.length} / 6 points`;
    this.$('#designer-frame').classList.toggle('adding-point',this.addMode);
    this.$('#designer-hint').textContent=this.addMode?'Click anywhere on the surface to place a bend point.':'Drag the crosshair to move the pattern. Drag numbered points to pull the liquid.';
    const point=recipe.points[this.selected];
    this.$('#point-details').hidden=!point;this.$('#point-empty').hidden=!!point;
    this.$('#selected-point-title').textContent=point?`BEND POINT ${this.selected+1}`:'BEND POINT';
    if(point){for(const key of ['radius','strength']){const input=this.$('#point-'+key);input.value=Math.round(point[key]*100);input.style.setProperty('--progress',((Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');this.$('#point-'+key+'-output').textContent=Math.round(point[key]*100)+'%';}}
    this.syncHandles();this.updateHistoryButtons();
  }
  syncHandles() {
    const recipe=this.getRecipe(),layer=this.$('#designer-handles');
    // Reuse nodes during drags, preserving pointer capture and keyboard focus.
    let center=layer.querySelector('[data-handle="center"]');
    if(!center){center=document.createElement('button');center.className='surface-handle center-handle';center.dataset.handle='center';center.setAttribute('aria-label','Move pattern center with arrow keys or drag');center.title='Pattern center · drag to move';center.textContent='+';layer.append(center);}
    center.style.left=recipe.centerX+'%';center.style.top=(100-recipe.centerY)+'%';
    layer.querySelectorAll('[data-point]').forEach(button=>{if(!recipe.points[Number(button.dataset.point)])button.remove();});
    recipe.points.forEach((point,index)=>{
      let button=layer.querySelector(`[data-point="${index}"]`);
      if(!button){button=document.createElement('button');button.className='surface-handle bend-handle';button.dataset.point=index;button.textContent=index+1;button.setAttribute('aria-label',`Bend point ${index+1}. Drag or use arrow keys to pull the surface.`);button.addEventListener('focus',()=>{this.selected=index;this.sync();});layer.append(button);}
      button.style.left=(point.x*100)+'%';button.style.top=((1-point.y)*100)+'%';button.classList.toggle('selected',index===this.selected);
    });
    const ring=this.$('#influence-ring'),point=recipe.points[this.selected];ring.hidden=!point;
    if(point){const height=this.$('#designer-frame').clientHeight;ring.style.left=(point.x*100)+'%';ring.style.top=((1-point.y)*100)+'%';ring.style.width=ring.style.height=(point.radius*height*2)+'px';}
  }
  coordinates(event) {const r=this.$('#designer-frame').getBoundingClientRect();return {x:clamp((event.clientX-r.left)/r.width,0,1),y:clamp(1-(event.clientY-r.top)/r.height,0,1)};}
  pointerDown(event) {
    if(event.button!==0)return;
    const handle=event.target.closest('.surface-handle'),position=this.coordinates(event);
    if(handle){this.selected=handle.dataset.point===undefined?-1:Number(handle.dataset.point);this.dragging=handle.dataset.handle==='center'?'center':this.selected;handle.focus();this.sync();}
    else if(this.addMode&&this.getRecipe().points.length<6){
      const points=clone(this.getRecipe().points);points.push({...position,originX:position.x,originY:position.y,radius:.3,strength:1});this.selected=points.length-1;this.addMode=false;this.apply({points});this.dragging=this.selected;
    } else return;
    event.preventDefault();this.$('#designer-frame').setPointerCapture(event.pointerId);
  }
  pointerMove(event) {
    if(this.dragging===undefined||this.dragging===null)return;
    const position=this.coordinates(event);
    if(this.dragging==='center')this.apply({centerX:Math.round(position.x*100),centerY:Math.round(position.y*100)},{commit:false});
    else {const points=clone(this.getRecipe().points);points[this.dragging].x=position.x;points[this.dragging].y=position.y;this.apply({points},{commit:false});}
  }
  handleKey(event) {
    const handle=event.target.closest('.surface-handle');if(!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'].includes(event.key))return;
    event.preventDefault();const index=handle.dataset.point===undefined?-1:Number(handle.dataset.point),step=event.shiftKey?.05:.01;
    if(['Delete','Backspace'].includes(event.key)){if(index>=0){const points=clone(this.getRecipe().points);points.splice(index,1);this.selected=-1;this.apply({points});}return;}
    const dx=event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,dy=event.key==='ArrowUp'?step:event.key==='ArrowDown'?-step:0;
    if(index<0){this.apply({centerX:clamp(this.getRecipe().centerX+dx*100,0,100),centerY:clamp(this.getRecipe().centerY+dy*100,0,100)});}
    else {const points=clone(this.getRecipe().points);points[index].x=clamp(points[index].x+dx,0,1);points[index].y=clamp(points[index].y+dy,0,1);this.apply({points});}
  }
  resize() {
    if(!this.dialog.open)return;
    const area=this.$('.designer-canvas-area'),frame=this.$('#designer-frame');const ratio=aspectRatio(this.getRecipe().aspect);
    const width=Math.min(area.clientWidth-36,Math.max(200,area.clientHeight-36)*ratio);
    frame.style.width=Math.max(100,width)+'px';frame.style.aspectRatio=String(ratio);this.syncHandles();this.render();
  }
  render() {
    if(this.frame||!this.dialog.open)return;
    this.frame=requestAnimationFrame(()=>{
      this.frame=0;if(!this.renderTarget)return;
      const frame=this.$('#designer-frame'),dpr=Math.min(devicePixelRatio||1,1.5);
      try{this.renderTarget.render(this.getRecipe(),{width:Math.max(1,Math.round(frame.clientWidth*dpr)),height:Math.max(1,Math.round(frame.clientHeight*dpr)),view:'surface'});}
      catch(error){this.onError(error.message);}
    });
  }
}
