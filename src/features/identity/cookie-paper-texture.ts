import * as THREE from "three";

/** Paper grain and faint interrupted circular scuffing; never baked into ink. */
export function createCookiePaperTexture(size = 512) {
  const pixels = new Uint8Array(size * size * 4);
  let seed = 7319;
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const dx=(x+.5)/size-.5, dy=(y+.5)/size-.5;
    const radius=Math.hypot(dx,dy), angle=Math.atan2(dy,dx);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grainX=((seed>>>24)/255-.5)*.035;
    const grainY=(((seed>>>16)&255)/255-.5)*.035;
    // Interrupted rather than perfect concentric lines, fading near the bore.
    const fade=THREE.MathUtils.smoothstep(radius,.035,.08);
    const breakup=.4+.6*Math.pow(.5+.5*Math.sin(angle*5+radius*43),2);
    const scuff=(Math.sin(radius*1900+Math.sin(angle*3)*.5)*.018+
      Math.sin(radius*3300+Math.sin(angle*7))*.006)*breakup*fade;
    const nx=grainX+(radius?dx/radius*scuff:0), ny=grainY+(radius?dy/radius*scuff:0);
    const length=Math.hypot(nx,ny,1), i=(y*size+x)*4;
    pixels[i]=Math.round((nx/length*.5+.5)*255);
    pixels[i+1]=Math.round((ny/length*.5+.5)*255);
    pixels[i+2]=Math.round((1/length*.5+.5)*255);
    pixels[i+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.name="Cookie paper grain and faint circular scuffs";
  texture.flipY=true;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}
