import { DEFAULT, LIMITS, sanitizeRecipe, aspectRatio, exportDimensions, encodeRecipe, decodeRecipe, seededRandom } from './model.js';
import { PRESETS, PALETTES } from './presets.js';
import { WallpaperRenderer } from './renderer.js';
import { SurfaceEditor } from './surface-editor.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const STORAGE_KEY='slit-studio:recipe:v1';
let recipe={...DEFAULT}, activePreset='vermilion', resetPreset='vermilion', view='slit', renderer;
let animation=false, lastFrame=0, frameRequest=0, saveTimer=0, toastTimer=0, comparison=.5, exportSize=3840;

const SLIDERS = {
  'surface-sliders': [ ['flow','Liquid flow','%'], ['scale','Gradient scale','%'], ['tilt','Surface tilt','°'], ['phase','Animation phase',' rad',.01,0,Math.PI*2] ],
  'color-sliders': [ ['contrast','Contrast','%'] ],
  'slit-sliders': [ ['count','Strip count','',1], ['angle','Cut angle','°'], ['offset','Displacement','%'], ['variation','Irregularity','%'], ['length','Strip length','%'], ['lengthVariation','Length variation','%'], ['gap','Space between','%'] ],
  'light-sliders': [ ['gloss','Gloss & shine','%'], ['lightAngle','Light direction','°'], ['relief','Strip depth','%'] ],
  'finish-sliders': [ ['textureAmount','Texture strength','%'], ['grain','Film grain','%'], ['grainSize','Grain size','×',.1], ['vignette','Vignette','%'] ]
};
for (const [id,sliders] of Object.entries(SLIDERS)) {
  $('#'+id).innerHTML=sliders.map(([key,label,unit,step=1,min=LIMITS[key][0],max=LIMITS[key][1]])=>`<div class="slider-control"><label class="slider-label" for="control-${key}"><span>${label}</span><output id="output-${key}" for="control-${key}" data-unit="${unit}"></output></label><input id="control-${key}" type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}" aria-label="${label}"></div>`).join('');
}

function toast(message) {
  clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');
  toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify({recipe,activePreset}));}catch{/* Storage is optional. */}},200);
}
function presetTitle() {
  const index=PRESETS.findIndex(p=>p.id===activePreset), preset=PRESETS[index];
  $('#canvas-title').textContent=preset ? `${String(index+1).padStart(2,'0')} / ${preset.name.toUpperCase()}` : 'YOUR OWN / UNTITLED';
}
function syncControls() {
  for(const input of $$('[data-setting]')) {
    const key=input.dataset.setting;
    if(input.type==='checkbox') input.checked=recipe[key];else input.value=recipe[key];
    if(input.type==='range') {
      const percent=(recipe[key]-Number(input.min))/(Number(input.max)-Number(input.min))*100;
      input.style.setProperty('--progress',percent+'%');
      const output=$('#output-'+key);output.textContent=(Number.isInteger(recipe[key]) ? recipe[key] : Number(recipe[key]).toFixed(1))+output.dataset.unit;
    }
  }
  for(const key of ['dark','mid','light']) $('#hex-'+key).textContent=recipe[key];
  $$('.preset-card').forEach(card=>{const active=card.dataset.preset===activePreset;card.classList.toggle('active',active);card.setAttribute('aria-pressed',String(active));});
  $('#canvas-frame').style.aspectRatio=String(aspectRatio(recipe.aspect));
  syncPhaseControl();
  fitCanvas();presetTitle();updateExportLabels();
}
function syncPhaseControl() {
  const input=$('#control-phase'),phase=recipe.phase,turn=Math.PI*2;
  input.min=Math.min(0,Math.floor(phase/turn)*turn);input.max=Math.max(turn,Math.ceil(phase/turn)*turn);
  input.value=phase;input.style.setProperty('--progress',((phase-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');
  $('#output-phase').textContent=phase.toFixed(2)+' rad';
}
function fitCanvas() {
  const stage=$('#art-stage'), frame=$('#canvas-frame');
  const maxHeight=$('.canvas-workspace').classList.contains('expanded') || document.fullscreenElement ? window.innerHeight-180 : window.innerWidth<=760 ? (recipe.aspect==='9:16'?450:Infinity) : Math.max(240,stage.clientHeight-76);
  const available=stage.clientWidth-(window.innerWidth<=760?32:window.innerWidth<=1100?40:58);
  frame.style.width=Math.max(100,Math.min(available,maxHeight*aspectRatio(recipe.aspect)))+'px';
  requestRender();
}
function requestRender() {if(!frameRequest) frameRequest=requestAnimationFrame(renderFrame);}
function renderFrame(timestamp) {
  frameRequest=0;
  if(animation) {
    if(lastFrame) recipe.phase+=(Math.min(timestamp-lastFrame,80)/1000)*.13;
    lastFrame=timestamp;
    syncPhaseControl();
  }
  if(renderer && !renderer.lost) {
    const frame=$('#canvas-frame'), dpr=Math.min(window.devicePixelRatio||1,1.75);
    const width=Math.max(1,Math.round(frame.clientWidth*dpr)), height=Math.max(1,Math.round(frame.clientHeight*dpr));
    try {renderer.render(recipe,{width,height,view,compare:comparison});}
    catch(error){showRendererError(error);}
  }
  if(animation) requestRender();
}
function showRendererError(error) {
  $('#canvas-error').hidden=false;$('#canvas-error p').textContent=error.message||String(error);
  setAnimation(false);
}
function initRenderer() {
  try {renderer=new WallpaperRenderer($('#wallpaper'));$('#canvas-error').hidden=true;requestRender();renderThumbnails();}
  catch(error) {showRendererError(error);}
}
function updateRecipe(patch,{custom=true}={}) {
  recipe=sanitizeRecipe({...recipe,...patch});
  if(custom) activePreset=null;
  syncControls();persist();
}

// Restore a shared recipe before any locally saved work. Never evaluate recipe text.
const shared=decodeRecipe(location.hash);
if(shared) {recipe=shared;activePreset=null;}
else {try {const stored=JSON.parse(localStorage.getItem(STORAGE_KEY));if(stored?.recipe){recipe=sanitizeRecipe(stored.recipe);activePreset=PRESETS.some(p=>p.id===stored.activePreset)?stored.activePreset:null;resetPreset=activePreset||'vermilion';}} catch{/* Defaults also work without browser storage. */}}

for(const input of $$('[data-setting]')) {
  input.addEventListener('input',()=>{
    let value=input.type==='checkbox'?input.checked:input.type==='range'||input.type==='number'?Number(input.value):input.value;
    if(input.type==='number'&&input.value==='') return;
    if(input.dataset.setting==='phase')setAnimation(false);
    updateRecipe({[input.dataset.setting]:value});
  });
}
function activateTab(name,{focus=false}={}) {
  for(const tab of $$('.control-tab')) {const active=tab.dataset.tab===name;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}
  for(const panel of $$('.control-panels>[role=tabpanel]')) panel.hidden=panel.id!=='panel-'+name;
}
for(const tab of $$('.control-tab')) {
  tab.addEventListener('click',()=>activateTab(tab.dataset.tab));
  tab.addEventListener('keydown',e=>{
    const tabs=$$('.control-tab'),index=tabs.indexOf(tab);
    if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();let next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activateTab(tabs[next].dataset.tab,{focus:true});}
  });
}
function setView(next) {
  view=next;
  $$('[data-view]').forEach(button=>{const active=button.dataset.view===next;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  for(const id of ['comparison-labels','compare-handle','compare-slider']) $('#'+id).hidden=next!=='compare';
  requestRender();
}
$$('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('#compare-slider').addEventListener('input',e=>{comparison=Number(e.target.value)/100;$('#compare-handle').style.left=(comparison*100)+'%';requestRender();});

$('#preset-grid').innerHTML=PRESETS.map((preset,i)=>`<button class="preset-card${i===0?' active':''}" data-preset="${preset.id}" aria-pressed="${i===0}" aria-label="Load ${preset.name} preset"><div class="preset-image"><canvas width="400" height="190" aria-hidden="true"></canvas><span class="preset-check">${icon('check')}</span></div><div class="preset-meta"><span class="preset-name">${preset.name}</span><span class="preset-number">0${i+1}</span></div><span class="preset-description">${preset.description}</span></button>`).join('');
function loadPreset(id) {
  const preset=PRESETS.find(p=>p.id===id);if(!preset)return;
  setAnimation(false);recipe={...preset.recipe,aspect:recipe.aspect};activePreset=id;resetPreset=id;setView('slit');syncControls();persist();
}
$$('.preset-card').forEach(card=>card.addEventListener('click',()=>loadPreset(card.dataset.preset)));
function renderThumbnails() {
  // One temporary WebGL renderer, copied into six plain 2D canvases.
  const scratch=document.createElement('canvas');let thumbnails;
  try {
    thumbnails=new WallpaperRenderer(scratch);
    PRESETS.forEach(preset=>{thumbnails.render(preset.recipe,{width:480,height:240});const target=$(`[data-preset="${preset.id}"] canvas`);target.getContext('2d').drawImage(scratch,0,0,target.width,target.height);});
  } catch {/* The main renderer's error state already explains an unavailable WebGL device. */}
  finally {thumbnails?.dispose();}
}
function randomSeed() {return 1+Math.floor(Math.random()*999998);}
function randomize() {
  const seed=randomSeed(), random=seededRandom(seed), pick=values=>values[Math.floor(random()*values.length)];
  const base=pick(PRESETS),colors=pick(PALETTES);
  setAnimation(false);
  updateRecipe({...base.recipe,aspect:recipe.aspect,seed,dark:colors[0],mid:colors[1],light:colors[2],flow:Math.round(random()*80),scale:Math.round(45+random()*90),tilt:Math.round(-50+random()*100),count:Math.round(12+random()*36),angle:Math.round((random()>.65?1:0)*(-30+random()*60)),offset:Math.round(15+random()*60),grain:Math.round(10+random()*30),phase:0});
  setView('slit');
}
$('#randomize').addEventListener('click',randomize);
$('#new-seed').addEventListener('click',()=>updateRecipe({seed:randomSeed()}));
$('#reset-button').addEventListener('click',()=>{loadPreset(resetPreset);toast('Preset restored. A fresh starting point.');});
$('#palette-cycle').addEventListener('click',()=>{const index=PALETTES.findIndex(p=>p[1]===recipe.mid),colors=PALETTES[(index+1)%PALETTES.length];updateRecipe({dark:colors[0],mid:colors[1],light:colors[2]});});
function setAnimation(next) {
  animation=next;lastFrame=0;
  $('#animate-button').innerHTML=icon(animation?'pause':'play')+`<span>${animation?'Pause':'Animate'}</span>`;
  $('#animate-button').setAttribute('aria-pressed',String(animation));
  requestRender();if(!next)persist();
}
$('#animate-button').addEventListener('click',()=>setAnimation(!animation));
const surfaceEditor=new SurfaceEditor({getRecipe:()=>recipe,onChange:patch=>updateRecipe(patch),onError:toast});
$('#design-surface').addEventListener('click',()=>{setAnimation(false);surfaceEditor.open();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&animation)setAnimation(false);});

function updateExportLabels() {
  for(const size of [1920,3840]) $('#size-'+size).textContent=exportDimensions(size,recipe.aspect).join(' × ');
}
function openExport() {setAnimation(false);updateExportLabels();$('#export-error').hidden=true;$('#export-dialog').showModal();}
$('#export-button').addEventListener('click',openExport);
for(const button of $$('[data-close]')) button.addEventListener('click',()=>$('#'+button.dataset.close).close());
for(const dialog of $$('dialog')) dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close();}});
for(const id of ['about-button','footer-about']) $('#'+id).addEventListener('click',()=>$('#about-dialog').showModal());
$$('[data-size]').forEach(button=>button.addEventListener('click',()=>{
  exportSize=button.dataset.size==='custom'?'custom':Number(button.dataset.size);
  $$('[data-size]').forEach(b=>b.classList.toggle('active',b===button));$('#custom-dimensions').hidden=exportSize!=='custom';
  if(exportSize==='custom'){const [width,height]=exportDimensions(3840,recipe.aspect);$('#export-width').value=width;$('#export-height').value=height;}
}));
$('#download-button').addEventListener('click',async()=>{
  const button=$('#download-button'),format=$('#export-format').value;
  const [width,height]=exportSize==='custom'?[Number($('#export-width').value),Number($('#export-height').value)]:exportDimensions(exportSize,recipe.aspect);
  button.disabled=true;button.querySelector('span').textContent='Rendering your wallpaper…';$('#export-error').hidden=true;
  try {
    if(!renderer)throw new Error('The graphics renderer is not available.');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const blob=await renderer.export({...recipe},{width,height,format});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;
    anchor.download=`slit-studio-${activePreset||'custom'}-${recipe.seed}-${width}x${height}.${format==='jpeg'?'jpg':'png'}`;
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('#export-dialog').close();toast(`${width} × ${height} wallpaper exported. Make yourself at home.`);
  } catch(error){$('#export-error').textContent=error.message;$('#export-error').hidden=false;}
  finally {button.disabled=false;button.querySelector('span').textContent='Download wallpaper';}
});
$('#share-button').addEventListener('click',async()=>{
  setAnimation(false);
  const url=new URL(location.href);url.hash='recipe='+encodeRecipe(recipe);
  try{await navigator.clipboard.writeText(url.href);history.replaceState(null,'',url);toast('Recipe link copied. Every color, cut, and texture included.');}
  catch {
    // A selectable text field remains available when clipboard access is blocked.
    let dialog=$('#recipe-dialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='recipe-dialog';dialog.innerHTML='<h2>Your recipe link</h2><p class="dialog-description">Copy this link to reopen the exact artwork.</p><label class="field-label" for="recipe-link">Recipe URL</label><textarea id="recipe-link" rows="5" readonly style="width:100%;font-size:10px;padding:12px;border:1px solid #d8dacd;border-radius:4px"></textarea><button class="button button-dark" style="margin-top:15px">Done</button>';dialog.querySelector('button').addEventListener('click',()=>dialog.close());document.body.append(dialog);}
    $('#recipe-link').value=url.href;dialog.showModal();$('#recipe-link').select();
  }
});
window.addEventListener('hashchange',()=>{const restored=decodeRecipe(location.hash);if(restored){setAnimation(false);recipe=restored;activePreset=null;syncControls();persist();}});

$('#fullscreen-button').addEventListener('click',async()=>{
  const workspace=$('.canvas-workspace');
  try{if(document.fullscreenElement)await document.exitFullscreen();else if(workspace.requestFullscreen)await workspace.requestFullscreen();else workspace.classList.toggle('expanded');}
  catch{workspace.classList.toggle('expanded');}
  fitCanvas();
});
document.addEventListener('fullscreenchange',()=>{fitCanvas();$('#fullscreen-button').setAttribute('aria-label',document.fullscreenElement?'Exit expanded preview':'Expand preview');});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('.canvas-workspace').classList.contains('expanded')){$('.canvas-workspace').classList.remove('expanded');fitCanvas();return;}
  if(event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea,button,a,[contenteditable]')||$('dialog[open]'))return;
  if(event.key.toLowerCase()==='r')randomize();
  if(event.key.toLowerCase()==='e')openExport();
  if(event.code==='Space'){event.preventDefault();setAnimation(!animation);}
});
$('#wallpaper').addEventListener('renderer-error',e=>showRendererError(new Error(e.detail)));
$('#retry-renderer').addEventListener('click',()=>{
  // Replace a lost canvas to obtain a clean context with fresh shaders.
  const old=$('#wallpaper'),canvas=old.cloneNode(false);old.replaceWith(canvas);
  canvas.addEventListener('renderer-error',e=>showRendererError(new Error(e.detail)));initRenderer();
});
// Move the light source by dragging over the actual artwork.
let dragging=false;
$('#canvas-frame').addEventListener('pointerdown',event=>{if(view==='compare'||event.target!==$('#wallpaper'))return;dragging=true;event.target.setPointerCapture(event.pointerId);});
$('#canvas-frame').addEventListener('pointermove',event=>{
  if(!dragging)return;const rect=$('#wallpaper').getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width-.5,y=.5-(event.clientY-rect.top)/rect.height;
  updateRecipe({lightAngle:Math.round(Math.atan2(y,x)*180/Math.PI)});
});
$('#canvas-frame').addEventListener('pointerup',()=>dragging=false);
$('#canvas-frame').addEventListener('pointercancel',()=>dragging=false);
new ResizeObserver(fitCanvas).observe($('#art-stage'));
window.addEventListener('resize',fitCanvas);
syncControls();initRenderer();
