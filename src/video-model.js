import { phasePeriod, exportDimensions, validateDimensions } from './model.js';

export const VIDEO_FORMATS=[
  {id:'mp4-avc',label:'MP4 · H.264',codec:'avc',container:'mp4',mime:'video/mp4'},
  {id:'mp4-hevc',label:'MP4 · H.265 / HEVC',codec:'hevc',container:'mp4',mime:'video/mp4'},
  {id:'webm-vp9',label:'WebM · VP9',codec:'vp9',container:'webm',mime:'video/webm'},
  {id:'webm-av1',label:'WebM · AV1',codec:'av1',container:'webm',mime:'video/webm'},
  {id:'mp4-av1',label:'MP4 · AV1',codec:'av1',container:'mp4',mime:'video/mp4'}
];
export const VIDEO_FPS=[24,30,60,120];
export const QUALITY_FACTORS={high:.14,ultra:.28,maximum:.5};

/** Plan timestamps before allocating graphics/encoder resources. Endpoints are exclusive. */
export function videoPlan(recipe,settings,maxSize=8192) {
  const {fps,speed,start,end,mode,quality}=settings;
  const dimensions=settings.resolution==='custom'?[settings.width,settings.height]:exportDimensions(Number(settings.resolution),recipe.aspect);
  // YUV encoders generally require even frame dimensions. Never stretch an odd-size video.
  const [width,height]=dimensions.map(n=>Math.round(n/2)*2);
  if(!dimensions.every(Number.isFinite)||!validateDimensions(width,height,maxSize))throw new Error(`Choose dimensions from 64 to ${maxSize}px, up to 36 megapixels.`);
  if(!VIDEO_FPS.includes(fps))throw new Error('Choose 24, 30, 60, or 120 fps.');
  if(!Number.isFinite(speed)||speed<.05||speed>100)throw new Error('Animation speed must be between 0.05× and 100×.');
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>720||end<=start)throw new Error('Choose a start and end phase from 0–720°, with the end after the start.');
  if(!['cycle','pingpong','clip'].includes(mode))throw new Error('Choose a loop mode.');
  const span=(end-start)*Math.PI/180,period=phasePeriod(recipe.pattern);
  const closes=Math.abs(span/period-Math.round(span/period))<1e-8;
  if(mode==='cycle'&&!closes)throw new Error(`This pattern needs a ${Math.round(period*180/Math.PI)}° phase span for a seamless full-cycle loop. Choose Ping-pong for a shorter range.`);
  const desiredDuration=span/(.13*speed)*(mode==='pingpong'?2:1);
  const frames=Math.max(2,Math.round(desiredDuration*fps)),duration=frames/fps;
  if(frames>72000)throw new Error('This export exceeds 72,000 frames. Increase speed or shorten the phase range.');
  const bitrate=Math.round(quality==='custom'?settings.mbps*1e6:Math.min(500e6,Math.max(1e6,width*height*fps*QUALITY_FACTORS[quality])));
  if(!Number.isFinite(bitrate)||bitrate<1e6||bitrate>500e6)throw new Error('Choose a bitrate from 1 to 500 Mbps.');
  const format=VIDEO_FORMATS.find(f=>f.id===settings.format);
  if(!format)throw new Error('Choose an output format.');
  return {width,height,fps,frames,duration,bitrate,estimatedBytes:bitrate*duration/8,format,start:start*Math.PI/180,span,mode,loopable:mode==='pingpong'||closes};
}
export function framePhase(plan,index) {
  const t=index/plan.frames;
  return plan.start+plan.span*(plan.mode==='pingpong'?(1-Math.cos(t*Math.PI*2))*.5:t);
}
export function frameTime(plan,index) { return index/plan.fps; }
export function formatSize(bytes) {return bytes>=1e9?(bytes/1e9).toFixed(2)+' GB':bytes>=1e6?(bytes/1e6).toFixed(1)+' MB':Math.max(1,Math.round(bytes/1e3))+' KB';}
