import * as THREE from "three";

export type ReliefMasks = {uv: string; emboss: string; deboss: string};
export type SurfaceReliefMasks = {A: ReliefMasks; B: ReliefMasks; sleeveA: ReliefMasks; sleeveB: ReliefMasks};

/** Shallow paper relief in millimetres; normals remain portable in standard GLB. */
export function reliefNormalPixels(height: Float32Array, size: number, surfaceMm: number) {
  const pixels = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Sobel derivatives give a stable rounded transition over antialiased edges.
    const dx = ((at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1)) - (at(x-1,y-1)+2*at(x-1,y)+at(x-1,y+1))) / 8;
    const dy = ((at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1)) - (at(x-1,y-1)+2*at(x,y-1)+at(x+1,y-1))) / 8;
    const nx = -dx * size / surfaceMm, ny = dy * size / surfaceMm;
    const length = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    pixels[i] = Math.round((nx / length * .5 + .5) * 255);
    pixels[i+1] = Math.round((ny / length * .5 + .5) * 255);
    pixels[i+2] = Math.round((1 / length * .5 + .5) * 255);
    pixels[i+3] = 255;
  }
  return pixels;
}

export function applyPrintRelief(material: THREE.MeshPhysicalMaterial, images: Partial<Record<keyof ReliefMasks, HTMLImageElement>>, surfaceMm: number, flip = false) {
  const previousNormalMap = material.normalMap;
  const size = 1024, height = new Float32Array(size * size), uv = new Float32Array(size * size);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", {willReadFrequently: true});
  if (!context) throw Error("Canvas unavailable for print relief.");
  for (const key of ["uv", "emboss", "deboss"] as const) {
    const image = images[key]; if (!image) continue;
    context.clearRect(0,0,size,size); context.save();
    if (flip) {context.translate(size,0);context.scale(-1,1);}
    context.drawImage(image,0,0,size,size);context.restore();
    const data = context.getImageData(0,0,size,size).data;
    for (let p=0;p<height.length;p++) {
      const coverage = data[p*4]/255 * data[p*4+3]/255;
      height[p] += coverage * 0.8 * (key === "deboss" ? -1 : 1);
      if (key === "uv") uv[p] = Math.min(1, coverage * 20);
    }
  }
  const texture = (data: Uint8Array, name: string) => {
    const map = new THREE.DataTexture(new Uint8Array(data),size,size,THREE.RGBAFormat);
    map.name=name;map.flipY=true;map.magFilter=THREE.LinearFilter;
    map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
    return map;
  };
  // Preserve fine stock grain where present, while adding the relief normals.
  const normals = reliefNormalPixels(height,size,surfaceMm);
  const grain = material.normalMap?.image as {data?: Uint8Array; width?: number; height?: number} | undefined;
  if (grain?.data && grain.width && grain.height) {
    const repeat = material.normalMap!.repeat;
    for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const g=(((Math.floor(y/size*grain.height*repeat.y)%grain.height)*grain.width)+(Math.floor(x/size*grain.width*repeat.x)%grain.width))*4;
      const i=(y*size+x)*4;
      normals[i]=Math.max(0,Math.min(255,normals[i]+(grain.data[g]-128)*material.normalScale.x));
      normals[i+1]=Math.max(0,Math.min(255,normals[i+1]+(grain.data[g+1]-128)*material.normalScale.y));
    }
  }
  // The original stock texture can be shared by both sleeve faces. Its owner
  // keeps it alive until preview cleanup; do not dispose it here.
  material.normalMap = texture(normals,"Print finish relief normals");
  material.normalScale.set(1,1);
  if (images.uv) {
    const roughness = new Uint8Array(size*size*4), coat = new Uint8Array(size*size*4);
    for(let p=0;p<uv.length;p++) {
      const r=Math.round((material.roughness*(1-uv[p])+.07*uv[p])*255), c=Math.round(uv[p]*255);
      roughness.set([r,r,r,255],p*4);coat.set([c,c,c,255],p*4);
    }
    material.roughnessMap = texture(roughness,"Spot UV gloss mask");material.roughness=1;
    material.clearcoatMap = texture(coat,"Spot UV clear varnish");material.clearcoat=1;
    material.clearcoatRoughness=.07;
  }
  material.needsUpdate=true;
  return previousNormalMap;
}
