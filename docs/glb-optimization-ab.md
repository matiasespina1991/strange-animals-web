# GLB optimization A/B

## Experimental WebP

Append `&glbWebp=1` (or `?glbWebp=1` without existing parameters) and reopen the
preview before sharing. Color artwork, including transparency, is encoded by
the browser at quality 0.94 and embedded directly through a Three.js exporter
adapter using required `EXT_texture_webp`. Normal, roughness, relief and alpha
mask maps retain PNG. No dependency or node_modules patch is needed.

Remove the parameter for the existing JPEG/PNG path. The WebP GLB requires a
viewer supporting the extension; Android AR and iOS Quick Look conversion must
be tested on devices before making this the default. Unsupported browser
encoding fails explicitly instead of mislabelling PNG bytes as WebP. Existing
shared models are unchanged until exported again. Automated tests exercise the
real Three GLB writer with a mocked canvas; visual quality and real encoding
performance still need browser/device comparison.

Experimental changes 2, 3, 4 and 7 are enabled by default. Geometry and artwork resolution are unchanged.

- Baseline: append `&glbBaseline=1` to the editor URL (or `?glbBaseline=1` without existing parameters).
- Disable individual experiments: `&glbDisable=2,4`.
- 2: share byte-identical canvas image sources, retaining each texture's UV transforms and color-space settings. Hash matches are verified byte for byte.
- 3: empty sleeve captures use one pixel, skip font embedding and export as material color. Other opaque uniform artwork maps are also replaced with material color. Label shading/transparency is retained.
- 4: opaque color artwork uses JPEG; transparent artwork and data maps remain PNG. Three.js controls JPEG encoding quality.
- 7: omit inactive material maps from the exported model. Finish-mask generation was already conditional; ink masks remain because they contribute microrelief. This does not remove processing required by the live preview.

Reopen the preview after changing parameters. Compare the same saved version, viewing angle and lighting. Record GLB bytes, creation/upload time, and download/load time separately. Inspect tiny lettering, photographs, ring highlights, UV orientation and transparent edges. No browser-based visual comparison or production deployment has been performed for these experiments yet.
