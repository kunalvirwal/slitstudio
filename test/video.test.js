import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT } from '../src/model.js';
import { videoPlan,framePhase,frameTime } from '../src/video-model.js';
const settings={resolution:1920,fps:60,speed:10,start:0,end:720,mode:'cycle',quality:'ultra',format:'mp4-avc'};

test('full loop samples the phase span without duplicating its endpoint',()=>{
  const plan=videoPlan(DEFAULT,settings);
  assert.equal(framePhase(plan,0),0);
  assert.equal(frameTime(plan,0),0);
  assert.ok(framePhase(plan,plan.frames-1)<Math.PI*4);
  const increment=Math.PI*4/plan.frames;
  assert.ok(Math.abs(framePhase(plan,plan.frames-1)+increment-Math.PI*4)<1e-10);
  assert.ok(Math.abs(frameTime(plan,plan.frames-1)+1/plan.fps-plan.duration)<1e-10);
});
test('speed changes duration without changing the sampled loop endpoints',()=>{
  const slow=videoPlan(DEFAULT,{...settings,speed:1}),fast=videoPlan(DEFAULT,{...settings,speed:2});
  assert.ok(Math.abs(slow.duration/fast.duration-2)<.001);
  assert.equal(slow.span,fast.span);
});
test('partial spans cannot be mislabeled as full-cycle seamless loops',()=>{
  assert.throws(()=>videoPlan(DEFAULT,{...settings,start:90,end:180}),/720/);
  const vortex={...DEFAULT,pattern:'vortex'};
  assert.equal(videoPlan(vortex,{...settings,end:360}).loopable,true);
  assert.equal(videoPlan(vortex,settings).loopable,true);
});
test('ping-pong smoothly closes a partial range and a clip is explicitly non-looping',()=>{
  const plan=videoPlan(DEFAULT,{...settings,end:180,mode:'pingpong'});
  assert.equal(framePhase(plan,0),0);
  assert.ok(Math.abs(framePhase(plan,plan.frames/2)-Math.PI)<1e-10);
  assert.ok(framePhase(plan,plan.frames-1)<.001);
  assert.equal(videoPlan(DEFAULT,{...settings,end:180,mode:'clip'}).loopable,false);
  assert.equal(videoPlan(DEFAULT,{...settings,end:720,mode:'clip'}).loopable,true);
});
test('frame dimensions, timing, and bitrate are bounded before resource allocation',()=>{
  const plan=videoPlan({...DEFAULT,aspect:'9:16'},{...settings,resolution:3840});
  assert.deepEqual([plan.width,plan.height],[2160,3840]);
  for(const patch of [{speed:0},{speed:Infinity},{start:0,end:721},{fps:1000},{quality:'custom',mbps:NaN},{quality:'custom',mbps:501},{resolution:'custom',width:9000,height:9000}])assert.throws(()=>videoPlan(DEFAULT,{...settings,...patch}));
  assert.throws(()=>videoPlan(DEFAULT,{...settings,resolution:7680},4096));
  const odd=videoPlan({...DEFAULT,aspect:'21:9'},settings);
  assert.equal(odd.height%2,0);
  assert.equal(Number.isInteger(odd.bitrate),true);
});
