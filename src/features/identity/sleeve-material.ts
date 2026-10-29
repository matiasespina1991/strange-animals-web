import * as THREE from "three";

/** Fine paper grain, independent of artwork RGB; exported as a standard normal map. */
export function createPrintedBoardGrain() {
  const size = 256;
  const pixels = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  const noise = (x: number, y: number, cells: number) => {
    const fx=x/size*cells, fy=y/size*cells, ix=Math.floor(fx), iy=Math.floor(fy);
    const hash=(a:number,b:number)=>{
      let n=Math.imul(a%cells+1541,374761393)^Math.imul(b%cells+7319,668265263);
      n=Math.imul(n^(n>>>13),1274126177);
      return ((n^(n>>>16))>>>0)/4294967295;
    };
    const tx=THREE.MathUtils.smoothstep(fx-ix,0,1),ty=THREE.MathUtils.smoothstep(fy-iy,0,1);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),tx),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),tx),ty);
  };
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    // Fine pores only: no coarse low-frequency lumps in the paper surface.
    height[y*size+x]=noise(x,y,128)*.35+noise(x,y,256)*.65;
  }
  const at=(x:number,y:number)=>height[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const nx=(at(x-1,y)-at(x+1,y))*.12,ny=(at(x,y-1)-at(x,y+1))*.12;
    const length=Math.hypot(nx,ny,1),i=(y*size+x)*4;
    pixels[i]=Math.round((nx/length*.5+.5)*255);
    pixels[i+1]=Math.round((ny/length*.5+.5)*255);
    pixels[i+2]=Math.round((1/length*.5+.5)*255);
    pixels[i+3]=255;
  }
  const grain = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  grain.name = "Fine printed paperboard grain";
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(24, 24);
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;
  return grain;
}
