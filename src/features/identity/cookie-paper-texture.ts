import * as THREE from "three";

/** Paper grain and faint interrupted circular scuffing; never baked into ink. */
export function createCookiePaperTexture(size = 1024) {
  const pixels = new Uint8Array(size * size * 4);
  const fibres = new Float32Array(size * size);
  let seed = 7319;
  const random = () => {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed / 4294967296;
  };
  // Short fibres of varying orientation, with tapered ends. These only change
  // the surface normals; neither paper nor printed artwork gets a color tint.
  for (let i=0;i<Math.round(size*size/150);i++) {
    const x=random()*size, y=random()*size, angle=random()*Math.PI*2;
    const length=2+random()*5, strength=.012+random()*.016;
    for(let step=-Math.ceil(length);step<=Math.ceil(length);step++) {
      const px=(Math.round(x+Math.cos(angle)*step)+size)%size;
      const py=(Math.round(y+Math.sin(angle)*step)+size)%size;
      fibres[py*size+px]+=strength*Math.max(0,1-Math.abs(step)/length);
    }
  }
  const fibreAt=(x:number,y:number)=>fibres[((y+size)%size)*size+(x+size)%size];
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const dx=(x+.5)/size-.5, dy=(y+.5)/size-.5;
    const radius=Math.hypot(dx,dy), angle=Math.atan2(dy,dx);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grainX=((seed>>>24)/255-.5)*.045;
    const grainY=(((seed>>>16)&255)/255-.5)*.045;
    // Interrupted rather than perfect concentric lines, fading near the bore.
    const fade=THREE.MathUtils.smoothstep(radius,.035,.08);
    const breakup=.4+.6*Math.pow(.5+.5*Math.sin(angle*5+radius*43),2);
    const scuff=(Math.sin(radius*1900+Math.sin(angle*3)*.5)*.018+
      Math.sin(radius*3300+Math.sin(angle*7))*.006)*breakup*fade;
    const nx=grainX+(radius?dx/radius*scuff:0)+fibreAt(x-1,y)-fibreAt(x+1,y);
    const ny=grainY+(radius?dy/radius*scuff:0)+fibreAt(x,y-1)-fibreAt(x,y+1);
    const length=Math.hypot(nx,ny,1), i=(y*size+x)*4;
    pixels[i]=Math.round((nx/length*.5+.5)*255);
    pixels[i+1]=Math.round((ny/length*.5+.5)*255);
    pixels[i+2]=Math.round((1/length*.5+.5)*255);
    pixels[i+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.name="Cookie paper pores, short fibres and faint circular scuffs";
  texture.flipY=true;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}

/** Small, untinted variations in the paper's satin reflection. */
export function createCookiePaperRoughnessTexture(size = 1024) {
  const pixels = new Uint8Array(size*size*4);
  let seed=19427;
  for(let i=0;i<pixels.length;i+=4) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const value=226+Math.round((seed>>>24)/255*29);
    pixels.set([value,value,value,255],i);
  }
  const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
  texture.name="Cookie paper micro roughness";
  // Non-directional grain needs no flip, including in standard GLB export.
  texture.flipY=false;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  return texture;
}
