import { WallpaperRenderer } from './renderer.js';
import { aspectRatio } from './model.js';

const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** A wallpaper-only preview with edge-revealed controls, independent of editor chrome. */
export class ImmersivePreview {
  constructor({getRecipe,isAnimating,onAnimate,onSpeed,onExport,onCopy,onRender,onError}) {
    Object.assign(this,{getRecipe,isAnimating,onAnimate,onSpeed,onExport,onCopy,onRender,onError});
    this.opened=false;this.hideTimer=0;
    this.element=document.createElement('section');this.element.id='immersive-preview';this.element.hidden=true;
    this.element.tabIndex=-1;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-label','Fullscreen wallpaper preview');
    this.element.innerHTML=`<canvas id="immersive-canvas" aria-label="Full screen liquid wallpaper"></canvas><div class="preview-hud preview-hud-top"><button class="preview-back">${icon('close')}<span>Back to studio</span><kbd>Esc</kbd></button><span class="preview-wordmark">slitstudio</span></div><div class="preview-hud preview-hud-bottom"><div class="immersive-info"><span>WALLPAPER PREVIEW</span><p>Move to an edge to reveal controls.</p></div><div class="immersive-actions"><button class="preview-animate" aria-label="Animate wallpaper">${icon('play')}<span>Animate</span></button><button class="preview-copy">${icon('link')}<span>Copy recipe</span></button><button class="preview-export">${icon('download')}<span>Export wallpaper</span></button></div></div>`;
    document.body.append(this.element);
    const speed=document.createElement('label');speed.className='preview-speed';speed.innerHTML='Speed <input type="number" min="0" max="10" step="0.05" value="1" aria-label="Preview animation speed"> ×';
    this.element.querySelector('.immersive-actions').prepend(speed);
    speed.querySelector('input').addEventListener('input',event=>{if(event.target.value!=='')this.onSpeed(Number(event.target.value));this.reveal();});
    speed.querySelector('input').addEventListener('blur',event=>event.target.value=this.getRecipe().animationSpeed);
    this.element.querySelector('.preview-back').addEventListener('click',()=>this.close());
    this.element.querySelector('.preview-animate').addEventListener('click',()=>{this.onAnimate();this.sync();this.reveal();});
    this.element.querySelector('.preview-copy').addEventListener('click',()=>{this.onCopy();this.reveal();});
    this.element.querySelector('.preview-export').addEventListener('click',async()=>{await this.close();this.onExport();});
    this.element.addEventListener('pointermove',event=>{
      const edge=event.clientY<100||event.clientY>innerHeight-120||event.clientX<65||event.clientX>innerWidth-65;
      if(edge||event.target.closest('.preview-hud'))this.reveal();
    });
    this.element.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')this.reveal();else if(!event.target.closest('.preview-hud'))this.element.focus();});
    this.element.addEventListener('focusin',()=>this.reveal());
    this.element.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();this.close();return;}
      if(event.code==='Space'&&!event.target.closest('button,input,select')){event.preventDefault();event.stopImmediatePropagation();this.onAnimate();this.sync();this.reveal();}
      if(event.key==='Tab'){
        this.reveal();const buttons=[...this.element.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===this.element)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    });
    document.addEventListener('fullscreenchange',()=>{if(this.opened&&this.nativeFullscreen&&!document.fullscreenElement)this.finishClose();else if(this.opened)this.onRender();});
    window.addEventListener('resize',()=>{if(this.opened)this.onRender();});
  }
  async open() {
    if(this.opened)return;
    this.returnFocus=document.activeElement;this.opened=true;this.nativeFullscreen=false;
    this.element.hidden=false;document.body.classList.add('wallpaper-preview-open');
    document.querySelector('main').inert=true;document.querySelector('header').inert=true;
    const old=this.element.querySelector('canvas');old.replaceWith(old.cloneNode(false));
    try{this.renderer=new WallpaperRenderer(this.element.querySelector('canvas'));}
    catch(error){this.finishClose();this.onError(error.message);return;}
    this.element.focus();this.sync();this.reveal();this.onRender();
    try{if(this.element.requestFullscreen){await this.element.requestFullscreen();this.nativeFullscreen=true;this.onRender();}}
    catch{/* The fixed overlay remains a full-window preview when native fullscreen is unavailable. */}
  }
  async close() {
    if(document.fullscreenElement===this.element){try{await document.exitFullscreen();}catch{/* Always restore the editor below. */}}
    this.finishClose();
  }
  finishClose() {
    if(!this.opened)return;
    this.opened=false;this.nativeFullscreen=false;clearTimeout(this.hideTimer);
    this.renderer?.dispose();this.renderer=null;this.element.hidden=true;
    document.body.classList.remove('wallpaper-preview-open');document.querySelector('main').inert=false;document.querySelector('header').inert=false;
    this.returnFocus?.focus();this.onRender();
  }
  reveal() {
    this.element.classList.add('hud-visible');clearTimeout(this.hideTimer);
    this.hideTimer=setTimeout(()=>{
      if(!this.element.querySelector('.preview-hud:hover')&&!document.activeElement?.closest('.preview-hud'))this.element.classList.remove('hud-visible');
    },2200);
  }
  sync() {
    const active=this.isAnimating(),button=this.element.querySelector('.preview-animate');
    button.innerHTML=icon(active?'pause':'play')+`<span>${active?'Pause':'Animate'}</span>`;
    button.setAttribute('aria-label',active?'Pause wallpaper animation':'Animate wallpaper');button.setAttribute('aria-pressed',String(active));
    const speed=this.element.querySelector('.preview-speed input');if(document.activeElement!==speed)speed.value=this.getRecipe().animationSpeed;
  }
  render() {
    if(!this.opened||!this.renderer)return;
    const recipe=this.getRecipe(),ratio=aspectRatio(recipe.aspect),width=Math.max(innerWidth,innerHeight*ratio),height=width/ratio;
    const canvas=this.renderer.canvas,dpr=Math.min(devicePixelRatio||1,1.5,this.renderer.maxSize/width,this.renderer.maxSize/height);
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    this.renderer.render(recipe,{width:Math.max(1,Math.round(width*dpr)),height:Math.max(1,Math.round(height*dpr)),view:'slit'});
  }
}
