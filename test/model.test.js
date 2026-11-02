import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT, sanitizeRecipe, encodeRecipe, decodeRecipe, exportDimensions, validateDimensions, seededRandom } from '../src/model.js';

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
