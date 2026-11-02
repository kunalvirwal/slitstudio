/** Serializable recipe schema, shared by controls, presets, URLs and the renderer. */
export const LIMITS = {
  flow: [0,100], scale: [20,200], tilt: [-90,90], contrast: [0,100],
  count: [2,100], angle: [-90,90], offset: [0,100], variation: [0,100], gap: [0,40], length: [10,100], lengthVariation: [0,100],
  gloss: [0,100], lightAngle: [-180,180], relief: [0,100], textureAmount: [0,100],
  grain: [0,100], grainSize: [1,5], vignette: [0,100], seed: [1,999999], phase: [-100000,100000]
};
export const ENUMS = {
  material: ['liquid','silk','chrome','ripple'], texture: ['smooth','frosted','brushed','woven'],
  distribution: ['wave','cascade','random','alternate'], aspect: ['16:9','16:10','21:9','9:16','1:1']
};
export const DEFAULT = {
  material:'liquid',flow:35,scale:74,tilt:-24,contrast:63,
  dark:'#15100f',mid:'#e83720',light:'#ffb296',
  slits:true,count:24,angle:0,offset:38,variation:25,gap:0,length:100,lengthVariation:0,distribution:'wave',
  gloss:64,lightAngle:-35,relief:52,texture:'smooth',textureAmount:30,
  grain:24,grainSize:1,vignette:30,seed:14829,aspect:'16:9',phase:0
};
export function sanitizeRecipe(input = {}) {
  const output = {...DEFAULT};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return output;
  for (const [key,[min,max]] of Object.entries(LIMITS)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) output[key] = Math.max(min,Math.min(max,input[key]));
  }
  for (const [key,values] of Object.entries(ENUMS)) if (values.includes(input[key])) output[key] = input[key];
  for (const key of ['dark','mid','light']) if (typeof input[key] === 'string' && /^#[0-9a-f]{6}$/i.test(input[key])) output[key] = input[key];
  if (typeof input.slits === 'boolean') output.slits = input.slits;
  output.seed = Math.round(output.seed); output.count = Math.round(output.count);
  return output;
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
