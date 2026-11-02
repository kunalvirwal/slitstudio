import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, sanitizeRecipe, encodeRecipe, decodeRecipe, exportDimensions, validateDimensions, seededRandom, phasePeriod, wrapPhase } from '../src/model.js';

test('shared recipes round-trip every visual parameter, including the frozen animation frame',()=>{
  const recipe={...DEFAULT,material:'chrome',texture:'brushed',phase:3.124,slits:false,seed:29452,aspect:'9:16'};
  assert.deepEqual(decodeRecipe('#recipe='+encodeRecipe(recipe)),recipe);
});
test('untrusted recipe links are bounded and cannot inject arbitrary CSS, enums or nonfinite numbers',()=>{
  const result=sanitizeRecipe({count:1e9,offset:-4,seed:NaN,flow:Infinity,dark:'url(https://invalid)',texture:'<script>',slits:'false',unknown:'discard',grain:0});
  assert.equal(result.count,100);assert.equal(result.offset,0);assert.equal(result.seed,DEFAULT.seed);
  assert.equal(result.flow,DEFAULT.flow);assert.equal(result.dark,DEFAULT.dark);assert.equal(result.texture,'smooth');
  assert.equal(result.slits,true);assert.equal(result.grain,0);assert.equal('unknown' in result,false);
  for(const invalid of ['#recipe=%broken','#recipe={"v":99}','#recipe=null','#recipe=[]'])assert.equal(decodeRecipe(invalid),null);
});
test('desktop and phone exports keep the requested long edge and aspect',()=>{
  assert.deepEqual(exportDimensions(3840,'16:9'),[3840,2160]);
  assert.deepEqual(exportDimensions(3840,'9:16'),[2160,3840]);
  assert.deepEqual(exportDimensions(1920,'1:1'),[1920,1920]);
  assert.deepEqual(exportDimensions(3840,'21:9'),[3840,1646]);
});
test('custom export rejects allocations beyond device and pixel limits',()=>{
  assert.equal(validateDimensions(3840,2160),true);
  for(const [w,h] of [[0,10],[32,200],[8000,8000],[9000,1000],[128.5,128],[Infinity,200]])assert.equal(validateDimensions(w,h),false);
  assert.equal(validateDimensions(4096,2160,2048),false);
});
test('a fixed seed reproduces random choices',()=>{
  const a=seededRandom(47),b=seededRandom(47),c=seededRandom(48);
  const sequence=Array.from({length:12},a);
  assert.deepEqual(sequence,Array.from({length:12},b));assert.notDeepEqual(sequence,Array.from({length:12},c));
});
test('direct surface edits survive sharing with bounded, independent pull points',()=>{
  const point={x:.62,y:.48,originX:.4,originY:.6,radius:.42,strength:1.3};
  const recipe={...DEFAULT,pattern:'vortex',turbulence:60,warpScale:180,phase:4.17,animationSpeed:2.75,points:[point]};
  assert.deepEqual(decodeRecipe('#recipe='+encodeRecipe(recipe)),recipe);
  const bounded=sanitizeRecipe({points:Array.from({length:30},()=>({x:999,y:-6,radius:100,strength:Infinity}))});
  assert.equal(bounded.points.length,6);assert.equal(bounded.points[0].x,1);assert.equal(bounded.points[0].y,0);
  assert.equal(bounded.points[0].radius,1.5);assert.equal(bounded.points[0].strength,1);
  bounded.points[0].x=.4;assert.equal(bounded.points[1].x,1);
  assert.equal(sanitizeRecipe({animationSpeed:Infinity}).animationSpeed,1);
  assert.equal(sanitizeRecipe({animationSpeed:1000}).animationSpeed,10);
});
test('animation phase wraps at the actual material loop boundary, including negative scrubs',()=>{
  for(const pattern of ['ribbons','pools','interference','vortex']) {
    const period=phasePeriod(pattern);
    assert.equal(wrapPhase(period,pattern),0);
    assert.ok(Math.abs(wrapPhase(period+.02,pattern)-.02)<1e-10);
    assert.ok(Math.abs(wrapPhase(-.02,pattern)-(period-.02))<1e-10);
    assert.equal(sanitizeRecipe({pattern,phase:period}).phase,0);
  }
  assert.equal(phasePeriod('vortex')*180/Math.PI,360);
  assert.equal(phasePeriod('ribbons')*180/Math.PI,720);
});
