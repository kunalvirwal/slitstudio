import { VIDEO_FORMATS,videoPlan,formatSize } from './video-model.js';
import { loadVideoLibrary,renderVideo } from './video-renderer.js';

const imageIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg>';
const typeCards=kind=>`<button class="${kind==='image'?'active':'video-image-tab'}" aria-pressed="${kind==='image'}">${imageIcon}<span>Image</span><small>PNG or JPEG · one frame</small></button><button class="${kind==='video'?'active':'open-video-export'}" aria-pressed="${kind==='video'}"><svg aria-hidden="true"><use href="#i-play"/></svg><span>Animated video</span><small>MP4 or WebM · a full loop</small></button>`;
export class VideoExportDialog {
  constructor({getRecipe,getMaxSize,onImage,onMessage}) {
    Object.assign(this,{getRecipe,getMaxSize,onImage,onMessage});
    this.busy=false;this.probeToken=0;this.url=null;this.selectedFormat='mp4-avc';
    this.dialog=document.createElement('dialog');this.dialog.id='video-export-dialog';this.dialog.setAttribute('aria-labelledby','video-export-title');
    this.dialog.innerHTML=`<div class="dialog-heading"><p class="eyebrow">MOTION, MADE YOURS</p><button class="icon-button video-close" aria-label="Close video export"><svg><use href="#i-close"/></svg></button></div>
      <div class="export-kind-switch" role="group" aria-label="Export type"><button class="video-image-tab">Image</button><button class="active" aria-pressed="true">Animated video</button></div>
      <h2 id="video-export-title">Put your wallpaper in motion<span>.</span></h2><p class="dialog-description video-description">Every frame rendered at full resolution. No screen recording, no dropped frames.</p>
      <fieldset class="video-fields"><div class="video-field-grid">
        <div><label class="field-label" for="video-resolution">Resolution</label><div class="select-wrap"><select id="video-resolution"><option value="1280">HD · 1280 px</option><option value="1920" selected>Full HD · 1920 px</option><option value="2560">QHD · 2560 px</option><option value="3840">4K · 3840 px</option><option value="5120">5K · 5120 px</option><option value="7680">8K · 7680 px</option><option value="custom">Custom dimensions</option></select><span>⌄</span></div></div>
        <div><label class="field-label" for="video-fps">Frame rate</label><div class="select-wrap"><select id="video-fps"><option value="24">24 fps · cinematic</option><option value="30" selected>30 fps</option><option value="60">60 fps · smooth</option><option value="120">120 fps · ultra smooth</option></select><span>⌄</span></div></div>
        <div class="video-custom-size" hidden><label class="field-label" for="video-width">Width</label><input id="video-width" type="number" min="64" max="8192" step="2" value="3840"></div><div class="video-custom-size" hidden><label class="field-label" for="video-height">Height</label><input id="video-height" type="number" min="64" max="8192" step="2" value="2160"></div>
        <div><label class="field-label" for="video-quality">Quality</label><div class="select-wrap"><select id="video-quality"><option value="high">High · compact</option><option value="ultra" selected>Ultra · fine detail</option><option value="maximum">Maximum · high bitrate</option><option value="custom">Custom bitrate</option></select><span>⌄</span></div></div>
        <div><label class="field-label" for="video-format">Format / codec</label><div class="select-wrap"><select id="video-format">${VIDEO_FORMATS.map(f=>`<option value="${f.id}">${f.label}</option>`).join('')}</select><span>⌄</span></div></div>
        <div id="video-custom-bitrate" hidden><label class="field-label" for="video-mbps">Bitrate · Mbps</label><input id="video-mbps" type="number" min="1" max="500" step="1" value="80"></div>
      </div><div class="video-section-title">ANIMATION & LOOP</div><div class="video-field-grid">
        <div><label class="field-label" for="video-speed">Animation speed · ×</label><input id="video-speed" type="number" min="0.05" max="100" step="0.05" value="1"></div>
        <div><label class="field-label" for="video-loop">Loop mode</label><div class="select-wrap"><select id="video-loop"><option value="cycle">Full-cycle loop</option><option value="pingpong">Ping-pong · any range</option><option value="clip">One-way clip</option></select><span>⌄</span></div></div>
        <div><label class="field-label" for="video-start-phase">Start phase · °</label><input id="video-start-phase" type="number" min="0" max="720" step="1" value="0"></div>
        <div><label class="field-label" for="video-end-phase">End phase · °</label><input id="video-end-phase" type="number" min="0" max="720" step="1" value="720"></div>
      </div><p class="video-loop-hint"></p><label class="toggle-row video-disk-row" for="video-disk" hidden><span>Save directly to disk<small>Best for large 4K / 8K files. Avoids keeping the video in browser memory.</small></span><input id="video-disk" type="checkbox" role="switch"></label></fieldset>
      <div class="video-summary" aria-live="polite"></div><p class="video-capabilities" role="status"></p><p class="video-error" role="alert" hidden></p>
      <div class="video-progress" hidden><div class="video-progress-heading"><span class="video-progress-label">Preparing…</span><span class="video-progress-percent">0%</span></div><progress max="1" value="0" aria-label="Video rendering progress"></progress><p class="video-progress-detail"></p></div>
      <div class="video-result" hidden><video controls loop playsinline aria-label="Rendered animated wallpaper preview"></video><p class="video-result-info"></p><button class="button button-dark video-download"><svg><use href="#i-download"/></svg>Download video</button></div>
      <div class="video-actions"><button class="button video-cancel" hidden>Cancel render</button><button class="button button-dark video-render" disabled><svg><use href="#i-play"/></svg><span>Render video</span></button></div><p class="video-footnote">Rendered locally in 8-bit SDR. Codec and resolution support depend on your browser and graphics hardware. Size is an estimate; higher bitrates preserve more grain.</p>`;
    const image=document.querySelector('#export-dialog');
    this.videoForm=document.createElement('div');this.videoForm.className='export-form video-export-form';this.videoForm.replaceChildren(...this.dialog.childNodes);
    this.dialog=image;this.imageForm=document.createElement('div');this.imageForm.className='export-form image-export-form';this.imageForm.replaceChildren(...image.childNodes);
    image.append(this.imageForm,this.videoForm);this.videoForm.hidden=true;
    this.$=s=>this.videoForm.querySelector(s);this.$$=s=>[...this.videoForm.querySelectorAll(s)];
    this.$('.export-kind-switch').innerHTML=typeCards('video');
    // Give each form a clear hierarchy; codec tuning is an optional advanced section.
    const firstGrid=this.$('.video-field-grid'),outputTitle=document.createElement('div');outputTitle.className='video-section-title video-output-title';outputTitle.textContent='01 / OUTPUT';firstGrid.before(outputTitle);
    const advanced=document.createElement('details');advanced.className='video-advanced';advanced.innerHTML='<summary><span>03 / QUALITY & CODEC</span><span class="video-quality-summary">Ultra · MP4</span></summary><div class="video-field-grid"></div>';
    for(const id of ['video-quality','video-format'])advanced.querySelector('.video-field-grid').append(this.$('#'+id).closest('.select-wrap').parentElement);
    advanced.querySelector('.video-field-grid').append(this.$('#video-custom-bitrate'));
    this.$('.video-loop-hint').after(advanced);
    this.$('.video-section-title:not(.video-output-title)').textContent='02 / ANIMATION & LOOP';
    this.$('.video-actions').before(this.$('.video-footnote'));
    this.$('.video-actions').prepend(this.$('.video-download'));this.$('.video-download').hidden=true;
    this.$('.video-description').textContent='Render a sharp, frame-perfect animation from your wallpaper.';
    const tabs=document.createElement('div');tabs.className='export-kind-switch';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Export type');
    tabs.innerHTML=typeCards('image');image.querySelector('.dialog-heading').after(tabs);tabs.querySelector('.open-video-export').addEventListener('click',()=>this.open());
    this.$('.video-image-tab').addEventListener('click',()=>{if(!this.busy)this.showImage();});
    this.$('.video-close').addEventListener('click',()=>{if(this.busy)this.controller?.abort();else this.dialog.close();});
    this.dialog.addEventListener('cancel',event=>{if(this.busy){event.preventDefault();this.controller?.abort();}});
    this.dialog.addEventListener('close',()=>{this.controller?.abort();this.probeToken++;this.releaseResult();});
    this.$$('fieldset input,fieldset select').forEach(input=>input.addEventListener(input.type==='number'?'input':'change',()=>{this.releaseResult();this.refresh();}));
    this.$('.video-cancel').addEventListener('click',()=>this.controller?.abort());
    this.$('.video-render').addEventListener('click',()=>this.start());
    this.$('.video-download').addEventListener('click',()=>{if(!this.url)return;const link=document.createElement('a');link.href=this.url;link.download=this.filename;link.click();});
  }
  open() {
    this.snapshot=structuredClone(this.getRecipe());this.$('#video-speed').value=this.snapshot.animationSpeed||1;
    this.$('#video-start-phase').value=0;this.$('#video-end-phase').value=720;
    const disk=typeof window.showSaveFilePicker==='function';this.$('.video-disk-row').hidden=!disk;
    this.$('.video-progress').hidden=true;this.$('.video-error').hidden=true;this.switchForm(true);if(!this.dialog.open)this.dialog.showModal();this.refresh();
  }
  showImage() {this.probeToken++;this.releaseResult();this.switchForm(false);}
  switchForm(video) {
    const before=this.dialog.open?this.dialog.getBoundingClientRect().height:0;
    this.imageForm.hidden=video;this.videoForm.hidden=!video;this.dialog.dataset.exportKind=video?'video':'image';
    this.dialog.setAttribute('aria-labelledby',video?'video-export-title':'export-title');
    this.dialog.scrollTop=0;
    if(before&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const after=this.dialog.getBoundingClientRect().height;
      this.dialog.animate([{height:before+'px'},{height:after+'px'}],{duration:200,easing:'ease-out'});
      (video?this.videoForm:this.imageForm).animate([{opacity:.4,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
    }
  }
  settings() {
    const value=id=>this.$('#video-'+id).value;
    return {resolution:value('resolution'),width:Number(value('width')),height:Number(value('height')),fps:Number(value('fps')),quality:value('quality'),mbps:Number(value('mbps')),format:value('format'),speed:Number(value('speed')),start:Number(value('start-phase')),end:Number(value('end-phase')),mode:value('loop')};
  }
  plan() {return videoPlan(this.snapshot,this.settings(),this.getMaxSize());}
  releaseResult() {
    const video=this.$('video');video.pause();video.removeAttribute('src');video.load();
    if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.$('.video-result').hidden=true;this.$('.video-download').hidden=true;this.$('.video-actions').classList.remove('has-result');
  }
  async refresh() {
    const token=++this.probeToken;this.$('.video-render').disabled=true;this.$('.video-render span').textContent='Checking settings…';this.$('.video-error').hidden=true;
    this.$$('.video-custom-size').forEach(el=>el.hidden=this.$('#video-resolution').value!=='custom');
    this.$('#video-custom-bitrate').hidden=this.$('#video-quality').value!=='custom';
    const period=this.snapshot.pattern==='vortex'?360:720;
    this.$('.video-loop-hint').textContent=`${period}° is one full cycle for this pattern. Full-cycle mode repeats seamlessly; Ping-pong smoothly reverses a shorter range. Speed sets the duration.`;
    try {
      const plan=this.plan();
      this.$('.video-summary').innerHTML=`<span><strong>${plan.width} × ${plan.height}</strong> · ${plan.fps} fps</span><span>${plan.duration.toFixed(2)} s · ${plan.frames.toLocaleString()} frames</span><span>${(plan.bitrate/1e6).toFixed(1)} Mbps · ≈ ${formatSize(plan.estimatedBytes)}</span><span class="video-loop-badge" title="${plan.loopable?'The end meets the beginning. Enable repeat in your player.':'The phase range does not close, so repeating may show a cut.'}">${plan.loopable?'↻ Seamless repeat':'Repeat will show a cut'}</span>`;
      this.$('.video-capabilities').textContent='Checking encoders for these settings…';
      if(!globalThis.VideoEncoder)throw new Error('Your browser does not expose WebCodecs video encoding. Use a current browser with WebCodecs to render video.');
      const media=await loadVideoLibrary(),quality=new media.Quality({bitrate:plan.bitrate});
      const supported=await Promise.all(VIDEO_FORMATS.map(f=>media.canEncodeVideo(f.codec,{width:plan.width,height:plan.height,frameRate:plan.fps,quality}).catch(()=>false)));
      if(token!==this.probeToken||!this.dialog.open)return;
      const options=[...this.$('#video-format').options];options.forEach((option,i)=>{option.disabled=!supported[i];option.textContent=VIDEO_FORMATS[i].label+(supported[i]?'':' · unavailable');});
      const selectedIndex=VIDEO_FORMATS.findIndex(f=>f.id===this.$('#video-format').value);
      if(!supported.some(Boolean))throw new Error('No encoder supports this combination on your device. Try a lower resolution, frame rate, or bitrate.');
      if(!supported[selectedIndex])this.$('#video-format').value=VIDEO_FORMATS[supported.findIndex(Boolean)].id;
      const qualityLabel=this.$('#video-quality').selectedOptions[0].textContent.split(' · ')[0];
      this.$('.video-quality-summary').textContent=qualityLabel+' · '+VIDEO_FORMATS.find(f=>f.id===this.$('#video-format').value).label;
      if(!this.$('#video-disk').checked&&plan.estimatedBytes>400*1024*1024)throw new Error('This video is too large for an in-memory download. Enable direct-to-disk saving, increase animation speed, or reduce bitrate / resolution.');
      this.$('.video-capabilities').textContent='✓ Available codecs checked for this resolution, frame rate, and quality.';
      this.$('.video-render').disabled=false;
      this.$('.video-render span').textContent='Render video';
    } catch(error) {
      if(token!==this.probeToken)return;
      this.$('.video-capabilities').textContent='';this.$('.video-error').textContent=error.message;this.$('.video-error').hidden=false;
      this.$('.video-render span').textContent='Render video';
    }
  }
  async start() {
    if(this.busy)return;
    let plan;
    try{plan=this.plan();}catch(error){this.$('.video-error').textContent=error.message;this.$('.video-error').hidden=false;return;}
    this.busy=true;this.controller=new AbortController();this.releaseResult();this.$('.video-error').hidden=true;
    this.$('.video-fields').disabled=true;this.$('.video-image-tab').disabled=true;this.$('.video-render').disabled=true;
    this.$('.video-progress').hidden=false;this.$('.video-cancel').hidden=false;
    this.$('.video-progress-label').textContent='Preparing encoder…';this.$('.video-progress-percent').textContent='0%';this.$('progress').value=0;this.$('.video-progress-detail').textContent='';
    this.filename=`slit-studio-${this.snapshot.seed}-${plan.width}x${plan.height}-${plan.fps}fps.${plan.format.container}`;
    const started=performance.now();let lastProgress=0;
    try {
      let fileHandle=null;
      if(this.$('#video-disk').checked&&typeof window.showSaveFilePicker==='function')fileHandle=await window.showSaveFilePicker({suggestedName:this.filename,types:[{description:plan.format.label,accept:{[plan.format.mime]:['.'+plan.format.container]}}]});
      const blob=await renderVideo(this.snapshot,plan,{signal:this.controller.signal,fileHandle,onProgress:progress=>{
        const now=performance.now();if(now-lastProgress<100&&!progress.finalizing&&progress.completed!==progress.total)return;lastProgress=now;
        const fraction=progress.completed/progress.total;
        this.$('progress').value=progress.finalizing?1:fraction;this.$('.video-progress-percent').textContent=Math.floor(fraction*100)+'%';
        this.$('.video-progress-label').textContent=progress.finalizing?'Finalizing video…':`Rendering frame ${progress.completed.toLocaleString()} / ${progress.total.toLocaleString()}`;
        const elapsed=(now-started)/1000,remaining=progress.completed>4?elapsed*(1/fraction-1):null;
        this.$('.video-progress-detail').textContent=progress.finalizing?'Writing the final playable file.':`Elapsed ${Math.round(elapsed)} s${remaining===null?'':` · about ${Math.ceil(remaining)} s remaining`}`;
      }});
      this.$('.video-progress').hidden=true;
      if(blob){this.url=URL.createObjectURL(blob);this.$('video').src=this.url;this.$('video').loop=plan.loopable;this.$('.video-result-info').textContent=`${plan.width} × ${plan.height} · ${plan.fps} fps · ${plan.duration.toFixed(2)} s · ${formatSize(blob.size)} · ${plan.format.label}`;this.$('.video-result').hidden=false;this.$('.video-download').hidden=false;this.$('.video-actions').classList.add('has-result');requestAnimationFrame(()=>this.dialog.scrollTo({top:this.dialog.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));}
      else this.onMessage('Video saved directly to disk.');
      this.$('.video-render span').textContent='Render again';
    } catch(error) {
      this.$('.video-progress').hidden=true;
      this.$('.video-error').textContent=error.name==='AbortError'?'Export canceled. Your wallpaper is unchanged.':error.message;
      this.$('.video-error').hidden=false;
    } finally {
      this.busy=false;this.controller=null;this.$('.video-fields').disabled=false;this.$('.video-image-tab').disabled=false;this.$('.video-cancel').hidden=true;this.$('.video-render').disabled=false;
    }
  }
}
