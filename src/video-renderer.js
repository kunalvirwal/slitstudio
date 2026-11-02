import { WallpaperRenderer } from './renderer.js';
import { framePhase,frameTime } from './video-model.js';

let mediaPromise;
export const loadVideoLibrary=()=>mediaPromise??=import('../vendor/mediabunny.min.mjs').catch(()=>{mediaPromise=null;throw new Error('The video encoder could not load. Refresh the studio and try again.');});
const yieldToBrowser=()=>new Promise(resolve=>setTimeout(resolve,0));
const abortError=()=>new DOMException('Export canceled.','AbortError');

/** Offline frame-by-frame encoding: render time never affects frame timing or phase. */
export async function renderVideo(recipe,plan,{signal,onProgress=()=>{},fileHandle=null}={}) {
  const media=await loadVideoLibrary();
  if(signal?.aborted)throw abortError();
  if(!globalThis.VideoEncoder)throw new Error('Video export needs WebCodecs. Open this studio in a current browser with video encoding support.');
  const quality=new media.Quality({bitrate:plan.bitrate});
  if(!await media.canEncodeVideo(plan.format.codec,{width:plan.width,height:plan.height,frameRate:plan.fps,quality}))throw new Error('This codec cannot encode the selected resolution and frame rate on this device. Try another codec or a smaller size.');
  if(signal?.aborted)throw abortError();
  const canvas=document.createElement('canvas');let renderer,output,writable;
  const cancelOutput=()=>{if(output&&['pending','started'].includes(output.state))output.cancel().catch(()=>{});};
  signal?.addEventListener('abort',cancelOutput,{once:true});
  try {
    renderer=new WallpaperRenderer(canvas);
    if(plan.width>renderer.maxSize||plan.height>renderer.maxSize)throw new Error('This resolution exceeds the graphics device limit.');
    let target;
    if(fileHandle){writable=await fileHandle.createWritable();target=new media.StreamTarget(writable);}
    else target=new media.BufferTarget();
    const format=plan.format.container==='mp4'?new media.Mp4OutputFormat({fastStart:fileHandle?false:'in-memory'}):new media.WebMOutputFormat();
    output=new media.Output({format,target});
    // Reject unexpected encoder overshoot before an in-memory file exhausts the page.
    if(!fileHandle)target.on('write',({end})=>{if(end>512*1024*1024)throw new Error('The file reached the browser memory limit. Use direct-to-disk saving or a smaller export.');});
    canvas.width=plan.width;canvas.height=plan.height;
    const source=new media.CanvasSource(canvas,{codec:plan.format.codec,quality,latencyMode:'quality',keyFrameInterval:2,contentHint:'detail'});
    output.addVideoTrack(source,{frameRate:plan.fps});await output.start();
    for(let index=0;index<plan.frames;index++) {
      if(signal?.aborted)throw abortError();
      renderer.render({...recipe,aspect:`${plan.width}:${plan.height}`},{width:plan.width,height:plan.height,phase:framePhase(plan,index)});
      const error=renderer.gl.getError();
      if(error!==renderer.gl.NO_ERROR)throw new Error('The graphics device could not render this size. Try a lower resolution.');
      await source.add(frameTime(plan,index),1/plan.fps,index===0?{keyFrame:true}:undefined);
      onProgress({completed:index+1,total:plan.frames,finalizing:false});
      // Let cancel/progress/paint events run without relying on real-time playback.
      if(index%4===0)await yieldToBrowser();
    }
    if(signal?.aborted)throw abortError();
    source.close();onProgress({completed:plan.frames,total:plan.frames,finalizing:true});
    await output.finalize();
    if(signal?.aborted)throw abortError();
    return fileHandle?null:new Blob([target.buffer],{type:plan.format.mime});
  } catch(error) {
    if(output&&output.state!=='finalized'&&output.state!=='canceled')await output.cancel().catch(()=>{});
    else if(!output&&writable)await writable.abort().catch(()=>{});
    throw signal?.aborted?abortError():error;
  } finally {signal?.removeEventListener('abort',cancelOutput);renderer?.dispose();canvas.width=1;canvas.height=1;}
}
