import { vertexShader, fragmentShader } from './shaders.js';
import { aspectRatio, ENUMS, validateDimensions } from './model.js';

function compile(gl,type,source) {
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(error);}
  return shader;
}
const rgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);

/** Owns one WebGL context. Thumbnails reuse this context rather than allocating one per card. */
export class WallpaperRenderer {
  constructor(canvas) {
    this.canvas=canvas; this.lost=false;
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    if (!gl) throw new Error('WebGL is unavailable');
    this.gl=gl;
    const program=gl.createProgram();
    const vertex=compile(gl,gl.VERTEX_SHADER,vertexShader), fragment=compile(gl,gl.FRAGMENT_SHADER,fragmentShader);
    gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program=program;gl.useProgram(program);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'a_position');
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    this.uniforms={};
    const count=gl.getProgramParameter(program,gl.ACTIVE_UNIFORMS);
    for(let i=0;i<count;i++){const name=gl.getActiveUniform(program,i).name;this.uniforms[name]=gl.getUniformLocation(program,name);}
    this.onLost=e=>{e.preventDefault();this.lost=true;canvas.dispatchEvent(new CustomEvent('renderer-error',{detail:'Graphics context lost. Click Try again to restore the preview.'}));};
    canvas.addEventListener('webglcontextlost',this.onLost);
  }
  get maxSize() { return Math.min(8192,this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),...this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS)); }
  render(recipe,{width=this.canvas.width,height=this.canvas.height,view='slit',compare=.5,phase=recipe.phase}={}) {
    if(this.lost) throw new Error('Graphics context lost');
    const gl=this.gl;
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    gl.viewport(0,0,width,height);gl.useProgram(this.program);
    const values={
      aspect:aspectRatio(recipe.aspect),seed:recipe.seed,flow:recipe.flow/100,scale:recipe.scale/100,
      tilt:recipe.tilt*Math.PI/180,contrast:recipe.contrast/100,
      slits:Number(recipe.slits),count:recipe.count,angle:recipe.angle*Math.PI/180,offset:recipe.offset/100,
      variation:recipe.variation/100,gap:recipe.gap/100,length:recipe.length/100,lengthVariation:recipe.lengthVariation/100,distribution:ENUMS.distribution.indexOf(recipe.distribution),
      gloss:recipe.gloss/100,lightAngle:recipe.lightAngle*Math.PI/180,relief:recipe.relief/100,
      textureAmount:recipe.textureAmount/100,grain:recipe.grain/100,grainSize:recipe.grainSize,
      vignette:recipe.vignette/100,material:ENUMS.material.indexOf(recipe.material),texture:ENUMS.texture.indexOf(recipe.texture),
      phase,view:['slit','surface','compare'].indexOf(view),compare
    };
    for (const [key,value] of Object.entries(values)) gl.uniform1f(this.uniforms['u_'+key],value);
    gl.uniform2f(this.uniforms.u_resolution,width,height);
    for(const key of ['dark','mid','light']) gl.uniform3fv(this.uniforms['u_'+key],rgb(recipe[key]));
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  async export(recipe,{width,height,format='png'}) {
    if(!validateDimensions(width,height,this.maxSize)) throw new Error(`Choose dimensions from 64 to ${this.maxSize}px, with a maximum of 36 megapixels.`);
    // A separate context preserves the live artboard's size, recipe, and comparison mode.
    const canvas=document.createElement('canvas');
    const renderer=new WallpaperRenderer(canvas);
    try {
      renderer.render({...recipe,aspect:`${width}:${height}`},{width,height});
      const error=renderer.gl.getError();
      if(error!==renderer.gl.NO_ERROR) throw new Error('The graphics device could not render that size. Try a smaller resolution.');
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,format==='jpeg'?'image/jpeg':'image/png',.95));
      if(!blob) throw new Error('Image encoding failed. Try a smaller resolution.');
      return blob;
    } finally { renderer.dispose();canvas.width=1;canvas.height=1; }
  }
  dispose() {this.canvas.removeEventListener('webglcontextlost',this.onLost);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();}
}
