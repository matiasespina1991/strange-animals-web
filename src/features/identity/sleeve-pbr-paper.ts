import * as THREE from "three";

const ROOT = "/media/textures/ambientcg/paper001/";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error("Classic paper texture could not be loaded. Choose Current or retry."));
    image.src = url;
  });
}

/** OpenGL normals and micro-roughness only: artwork supplies all ink colors. */
export async function loadClassicSleevePaper() {
  const images = await Promise.all([
    loadImage(`${ROOT}Paper001_2K-JPG_NormalGL.jpg`),
    loadImage(`${ROOT}Paper001_2K-JPG_Roughness.jpg`),
  ]);
  return images.map((image, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2048;
    const context = canvas.getContext("2d", {willReadFrequently: true});
    if (!context) throw Error("Canvas unavailable for classic paper.");
    // Six tiles across a 315 mm sleeve keep the pores at the previous label scale.
    // Preserve the original
    // rectangular maps' aspect ratio so fibres are not stretched vertically.
    const tileWidth = 2048 / 6;
    const tileHeight = tileWidth * image.naturalHeight / image.naturalWidth;
    for (let y=0;y<Math.ceil(2048/tileHeight);y++) for(let x=0;x<6;x++) {
      context.drawImage(image,x*tileWidth,y*tileHeight,tileWidth,tileHeight);
    }
    if (index === 1) {
      const pixels = context.getImageData(0,0,2048,2048);
      for(let i=0;i<pixels.data.length;i+=4) {
        // Preserve the existing satin response, adding local variation only.
        const value = Math.round(220 + pixels.data[i+1] / 255 * 35);
        pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = value;
      }
      context.putImageData(pixels,0,0);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = index === 0 ? "ambientCG Paper001 sleeve normals" : "ambientCG Paper001 sleeve roughness";
    texture.colorSpace = THREE.NoColorSpace;
    texture.flipY = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
  });
}
