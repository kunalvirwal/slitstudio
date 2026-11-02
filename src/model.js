/** Serializable recipe schema, shared by controls, presets, URLs and the renderer. */
export const LIMITS = {
  flow: [0,100], scale: [20,200], tilt: [-90,90], contrast: [0,100],
  count: [2,100], angle: [-90,90], offset: [0,100], variation: [0,100], gap: [0,40], length: [10,100], lengthVariation: [0,100],
  gloss: [0,100], lightAngle: [-180,180], relief: [0,100], textureAmount: [0,100],
  grain: [0,100], grainSize: [1,5], vignette: [0,100], seed: [1,999999], phase: [-100000,100000],
  turbulence:[0,100],warpScale:[20,300],stretch:[25,250],position:[0,100],centerX:[0,100],centerY:[0,100],animationSpeed:[0,10]
};
export const ENUMS = {
  material: ['liquid','silk','chrome','ripple'], texture: ['smooth','frosted','brushed','woven'],
  distribution: ['wave','cascade','random','alternate'], aspect: ['16:9','16:10','21:9','9:16','1:1'],
  pattern:['ribbons','pools','vortex','interference']
};
export const DEFAULT = {
  material:'liquid',flow:35,scale:74,tilt:-24,contrast:63,
  dark:'#15100f',mid:'#e83720',light:'#ffb296',
  slits:true,count:24,angle:0,offset:38,variation:25,gap:0,length:100,lengthVariation:0,distribution:'wave',
  gloss:64,lightAngle:-35,relief:52,edgeShading:true,texture:'smooth',textureAmount:30,
  grain:24,grainSize:1,vignette:30,seed:14829,aspect:'16:9',phase:0,
  pattern:'ribbons',turbulence:30,warpScale:100,stretch:100,position:0,centerX:50,centerY:50,points:[],animationSpeed:1
};
export function sanitizeRecipe(input = {}) {
  const output = {...DEFAULT,points:[]};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
  for (const [key,[min,max]] of Object.entries(LIMITS)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) output[key] = Math.max(min,Math.min(max,input[key]));
  }
  for (const [key,values] of Object.entries(ENUMS)) if (values.includes(input[key])) output[key] = input[key];
  for (const key of ['dark','mid','light']) if (typeof input[key] === 'string' && /^#[0-9a-f]{6}$/i.test(input[key])) output[key] = input[key];
  if (typeof input.slits === 'boolean') output.slits = input.slits;
  if (typeof input.edgeShading === 'boolean') output.edgeShading = input.edgeShading;
  // Pull points keep their original location so moving a handle pulls the material with it.
  output.points=Array.isArray(input.points)?input.points.slice(0,6).filter(p=>p&&typeof p==='object').map(p=>{
    const point={};
    for(const [key,fallback,min,max] of [['x',.5,0,1],['y',.5,0,1],['originX',.5,0,1],['originY',.5,0,1],['radius',.3,.05,1.5],['strength',1,0,2]]) {
      const value=p[key];point[key]=typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
    }
    return point;
  }):[];
  output.seed = Math.round(output.seed); output.count = Math.round(output.count);
  output.phase=wrapPhase(output.phase,output.pattern);
  return output;
}
export function phasePeriod(pattern) { return pattern==='vortex'?Math.PI*2:Math.PI*4; }
export function wrapPhase(phase,pattern) {
  const period=phasePeriod(pattern),remainder=phase%period;
  return remainder<0?remainder+period:remainder===0?0:remainder;
}
export function aspectRatio(aspect) { const [w,h] = aspect.split(':').map(Number); return w/h; }
export function exportDimensions(longEdge, aspect) {
  const ratio = aspectRatio(aspect);
  return ratio >= 1 ? [longEdge,Math.round(longEdge/ratio)] : [Math.round(longEdge*ratio),longEdge];
}
export function validateDimensions(width,height,maxSize=8192) {
  return Number.isInteger(width) && Number.isInteger(height) && width>=64 && height>=64 && width<=maxSize && height<=maxSize && width*height <= 36_000_000;
}
export function encodeRecipe(recipe) { return encodeURIComponent(JSON.stringify({v:1,...sanitizeRecipe(recipe)})); }
export function decodeRecipe(hash) {
  try { const input=JSON.parse(decodeURIComponent(hash.replace(/^#recipe=/,''))); return input.v===1 ? sanitizeRecipe(input) : null; } catch { return null; }
}
export function seededRandom(seed) {
  let a=seed|0;
  return () => {a|=0; a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
