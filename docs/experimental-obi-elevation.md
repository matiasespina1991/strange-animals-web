# Experimental OBI elevation

Available in Settings only on a development build served from localhost,
127.0.0.1 or IPv6 loopback. Each side has an independent enabled flag, start
position and width (percent of the sleeve, measured from that side's left),
and elevation from 0 to 0.5 mm. Zero creates no additional geometry.

The experiment raises the selected section of the existing artwork, not a
separate uploaded OBI image. Its top retains full-sleeve UV coordinates; its
walls are vertical. The existing cap triangulation is clipped to the band,
so the central window stays open even when it crosses the band. Side B mirrors
the horizontal coordinates and extrudes outward along negative Z.

Settings survive JSON import, gallery saves and normal undo/redo. Production
does not receive these options when opening its preview. A GLB shared from
localhost contains the experimental geometry, allowing external inspection.
Print artwork exports are unchanged. No deployment is required for local testing.

Regression checks: `npm run test:configurator` includes OBI dimensions, outward
elevation, per-side window combinations, retained artwork, zero height and
import validation.
