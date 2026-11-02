/** All material calculations use normalized artwork coordinates, independent of preview size. */
export const vertexShader = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }
`;

export const fragmentShader = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec3 u_dark, u_mid, u_light;
uniform float u_aspect, u_seed, u_flow, u_scale, u_tilt, u_contrast;
uniform float u_slits, u_count, u_angle, u_offset, u_variation, u_gap, u_distribution, u_length, u_lengthVariation;
uniform float u_gloss, u_lightAngle, u_relief, u_edgeShading, u_textureAmount, u_grain, u_grainSize, u_vignette;
uniform float u_material, u_texture, u_phase, u_view, u_compare;
uniform float u_pattern, u_turbulence, u_warpScale, u_stretch, u_position, u_pointCount;
uniform vec2 u_center;
uniform vec4 u_points[6];
uniform vec2 u_origins[6];
const float PI = 3.14159265359;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
mat2 rotation(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

// A continuous height field: broad, domain-warped ridges with layered flow.
float heightAt(vec2 p) {
  for (int i=0;i<6;i++) {
    if (float(i) < u_pointCount) {
      vec2 target = (u_points[i].xy-.5)*vec2(u_aspect,1.);
      vec2 origin = (u_origins[i]-.5)*vec2(u_aspect,1.);
      float radius = u_points[i].z;
      float influence = exp(-dot(p-target,p-target)/(radius*radius));
      p -= (target-origin)*influence*u_points[i].w;
    }
  }
  p -= u_center*vec2(u_aspect,1.);
  p = rotation(u_tilt) * p;
  p.y /= u_stretch;
  float seed = u_seed * .0017;
  float warp = sin(p.y * 2.4 * u_warpScale + seed + u_phase*.5) * .34;
  warp += sin(p.y * 5.3 * u_warpScale + p.x * 1.7 - seed*.8) * .10;
  warp += (noise(p * 2.3 * u_warpScale + seed) - .5) * u_turbulence * .5333;
  float x = p.x + warp * u_flow;
  float t = x * u_scale * 6.3 + seed*.3 + u_phase + u_position*PI*2.;
  if (u_pattern > .5 && u_pattern < 1.5) {
    t = length(vec2(p.x,p.y*1.15)) * u_scale * 10. - warp*u_flow*4. + u_phase + u_position*PI*2.;
  } else if (u_pattern > 1.5 && u_pattern < 2.5) {
    float radius = length(p);
    float theta = atan(p.y,p.x);
    // An integer angular harmonic keeps the polar field continuous at the atan seam.
    t = radius*u_scale*12. - theta*2. + sin(radius*6. + seed)*u_flow + u_phase + u_position*PI*2.;
  } else if (u_pattern > 2.5) {
    t = (sin(p.x*u_scale*5. + warp*u_flow*3.) + cos(p.y*u_scale*7. + seed*.2))*2.4 + u_phase + u_position*PI*2.;
  }
  float wave = .5 + .5 * sin(t + p.y * .16);
  if (u_material > .5 && u_material < 1.5) {
    wave = wave * .88 + .12 * (.5 + .5 * sin(t*2. + p.y*.7));
  } else if (u_material > 1.5 && u_material < 2.5) {
    wave = .5 + .5 * sin(t + .52 * sin(t*2. + p.y*.7));
  } else if (u_material > 2.5) {
    wave = .5 + .5 * sin(t + sin(p.y * 9. + t) * .24);
  }
  return pow(max(wave, .001), 1.4 + u_contrast * 1.8);
}

vec3 materialAt(vec2 p) {
  float h = heightAt(p);
  float eps = .003;
  vec2 grad = vec2(heightAt(p + vec2(eps,0)) - heightAt(p - vec2(eps,0)), heightAt(p + vec2(0,eps)) - heightAt(p - vec2(0,eps))) / (2. * eps);
  // Microtexture changes the reflection normal, in addition to its visible surface detail.
  float detail = 0.;
  if (u_texture > .5 && u_texture < 1.5) {
    vec2 tex = p * 680.;
    detail = (noise(tex) - .5) * u_textureAmount;
    grad += vec2(noise(tex+vec2(13,0))-.5,noise(tex+vec2(0,7))-.5) * u_textureAmount * 1.7;
  } else if (u_texture > 1.5 && u_texture < 2.5) {
    detail = (noise(p*vec2(9.,1800.)) - .5) * u_textureAmount;
    grad.y += detail * 2.;
  } else if (u_texture > 2.5) {
    detail = (sin(p.x*2200.) * sin(p.y*2200.)) * u_textureAmount * .35;
    grad += vec2(sin(p.x*2200.), sin(p.y*2200.)) * u_textureAmount * .35;
  }
  vec3 normal = normalize(vec3(-grad * (.05 + u_relief*.36), 1.));
  vec3 lightDir = normalize(vec3(cos(u_lightAngle)*.85,sin(u_lightAngle)*.85,1.));
  vec3 halfDir = normalize(lightDir+vec3(0,0,1));
  float diffuse = .65 + .35 * max(0.,dot(normal,lightDir));
  float glossPower = mix(8., 95., u_gloss);
  float specular = pow(max(dot(normal,halfDir),0.), glossPower) * u_gloss;
  float softReflection = pow(h, 6.) * .18 * u_gloss;
  vec3 color = mix(u_dark, u_mid, smoothstep(.015,1.,h) * diffuse);
  color = mix(color,u_light,clamp(specular * (.28 + h*.64) + softReflection,0.,.92));
  if (u_material > 1.5 && u_material < 2.5) {
    // A restrained chromatic reflection gives the chrome its iridescent edge.
    float edge = pow(1.-abs(normal.z),1.4) * u_gloss * .28;
    color += vec3(.20,.37,.42) * edge;
    color = mix(color,u_light,pow(h,20.)*.32*u_gloss);
  }
  color += detail * .12 * (color + .12);
  return max(color,vec3(0.));
}

void main() {
  vec2 uv = v_uv;
  vec2 p = (uv - .5) * vec2(u_aspect,1.);
  float sliced = u_slits;
  if (u_view > .5 && u_view < 1.5) sliced = 0.;
  if (u_view > 1.5) sliced *= step(u_compare,uv.x);
  vec2 source = p;
  float edgeShadow = 1.; float edgeLight = 0.; float gapMask = 1.;
  if (sliced > .5) {
    vec2 q = rotation(u_angle) * p;
    float stripCoord = q.x * u_count / u_aspect + u_count * .5;
    float strip = floor(stripCoord), local = fract(stripCoord);
    float id = strip / u_count;
    float rnd = hash(vec2(strip+19., u_seed*.013)) - .5;
    float shift = sin(id * PI*2. + u_seed*.001) * .55;
    if (u_distribution > .5 && u_distribution < 1.5) shift = (id-.5)*1.8;
    else if (u_distribution > 1.5 && u_distribution < 2.5) shift = rnd * 2.;
    else if (u_distribution > 2.5) shift = (mod(strip,2.)-.5)*1.3;
    shift += rnd * u_variation;
    if (u_length < .999 || u_lengthVariation > .001) {
      float span = abs(cos(u_angle)) + abs(sin(u_angle))*u_aspect;
      float halfLength = span * .5 * u_length * (1. - (rnd+.5)*u_lengthVariation*.8);
      float endDistance = halfLength - abs(q.y - shift*u_offset*.35);
      gapMask *= smoothstep(0.,2./u_resolution.y,endDistance);
    }
    q.y += shift * u_offset * 1.8;
    // Mild refraction makes every strip a lens into the same continuous material.
    q.x += (local-.5) * u_relief * .085;
    source = rotation(-u_angle) * q;
    float shadeWidth = .17 + u_relief*.37;
    edgeShadow = mix(1.-u_relief*u_edgeShading*.72,1.,smoothstep(0.,shadeWidth,local));
    edgeLight = exp(-local*62.) * u_relief * u_gloss * .10 * u_edgeShading;
    float feather = min(.03,u_count/u_resolution.x);
    // Zero is truly gapless. Applying smoothstep(0, feather, local) leaves a dark hairline.
    if (u_gap > .0001) gapMask *= smoothstep(u_gap,u_gap+feather,local);
  }
  vec3 color = materialAt(source) * edgeShadow + u_light * edgeLight;
  color = mix(u_dark*.43,color,gapMask);
  // Texture / grain coordinates use a fixed virtual 1920px long edge.
  // This gives exports and responsive previews the same physical-looking grain size.
  vec2 grainCoord = floor(uv * vec2(u_aspect,1.) * (1920. / max(u_aspect,1.)) / u_grainSize);
  float n = (hash(grainCoord + u_seed*.017) + hash(grainCoord.yx + 127.3) - 1.);
  color += n * u_grain * .22 * (.22 + sqrt(max(color,vec3(0.))));
  float vignette = dot((uv-.5)*vec2(1.,.8),(uv-.5)*vec2(1.,.8));
  color *= 1. - smoothstep(.03,.47,vignette) * u_vignette * .85;
  // Sub-LSB dither prevents visible banding in dark, grain-free exports.
  color += (hash(gl_FragCoord.xy)-.5)/255.;
  gl_FragColor = vec4(clamp(color,0.,1.),1.);
}
`;
