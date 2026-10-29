import type { PointerEventHandler } from "react";
import { TextSelectionGuide } from "./TextSelectionGuide";
import { InkBleedFilter } from "./InkBleedFilter";
import {
  circularPath,
  type LabelDesign,
  type LabelLayer,
  type LabelSide,
  type TextBlendMode,
  cylinderTextLayout,
  cylinderBackBlurBands,
  cylinderShading,
  cylinderOpacity,
  closedCylinderText,
  textExtrusion,
  extrusionOpacity,
  extrusionBlurBands,
  cylinderExtrusionSteps,
  circularCylinderSlices,
  imageRole,
  imageCropBounds,
  barcodeSourceMatrix,
  getSurfaceLayers,
  textFoilColor,
} from "./design-configurator-model";

function SvgLayerText({
  layer,
  index,
  prefix,
  fontFamily,
  text = layer.text,
  x = layer.x,
  y = layer.y,
  fontSize = layer.size,
  fill = layer.color,
  textAnchor = layer.align,
  textLength,
  opacity,
  transform,
  filter,
  blendMode,
  textureShade = 0,
}: {
  layer: LabelLayer;
  index: number;
  prefix: string;
  fontFamily: (layer: LabelLayer) => string;
  text?: string;
  x?: number;
  y?: number;
  fontSize?: number;
  fill?: string;
  textAnchor?: LabelLayer["align"];
  textLength?: number;
  opacity?: number;
  transform?: string;
  filter?: string;
  blendMode?: TextBlendMode;
  textureShade?: number;
}) {
  const activeBlendMode = blendMode ?? layer.blendMode;
  const textFill = layer.textTexture
    ? `url(#${prefix}-text-surface-${index})`
    : fill;
  const textureFilter =
    layer.textTexture && textureShade > 0
      ? `${filter ? `${filter} ` : ""}brightness(${Math.max(0, 1 - textureShade)})`
      : undefined;
  const closedArc =
    layer.kind === "circular" &&
    layer.textEffect?.type === "cylinder" &&
    layer.textEffect.closed;
  return (
    <text
      transform={transform}
      filter={textureFilter ? undefined : filter}
      fill={
        activeBlendMode === "difference" && !layer.textTexture
          ? "#ffffff"
          : textFill
      }
      fillOpacity={opacity}
      fontSize={fontSize}
      letterSpacing={layer.spacing}
      fontFamily={fontFamily(layer)}
      textAnchor={closedArc ? "start" : textAnchor}
      textLength={closedArc ? undefined : textLength}
      lengthAdjust={!closedArc && textLength ? "spacingAndGlyphs" : undefined}
      style={
        activeBlendMode === "difference" || textureFilter
          ? {
              ...(activeBlendMode === "difference"
                ? { mixBlendMode: "difference" }
                : {}),
              ...(textureFilter ? { filter: textureFilter } : {}),
            }
          : undefined
      }
      xmlSpace="preserve"
      {...(layer.kind === "circular" ? {} : { x, y })}
    >
      {layer.kind === "circular" ? (
        <textPath
          href={`#${prefix}-arc-${index}`}
          startOffset={
            closedArc
              ? "0%"
              : layer.align === "middle"
                ? "50%"
                : layer.align === "end"
                  ? "100%"
                  : "0%"
          }
        >
          {closedArc ? closedCylinderText(layer) : text.replace(/\n/g, " ")}
        </textPath>
      ) : (
        text.split("\n").map((line, lineIndex) => (
          <tspan
            key={lineIndex}
            x={x}
            dy={lineIndex ? `${layer.lineHeight ?? 1.1}em` : 0}
          >
            {line || "\u00a0"}
          </tspan>
        ))
      )}
    </text>
  );
}

function shadeText(color: string, amount: number) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const channels = color.match(/[\da-f]{2}/gi);
  if (!channels || channels.length !== 3) return color;
  return `#${channels
    .map((channel) =>
      Math.round(Number.parseInt(channel, 16) * (1 - amount))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function cylinderGeometry(layer: LabelLayer) {
  const slices = layer.kind === "circular" ? circularCylinderSlices(layer) : [];
  const layout =
    layer.kind === "circular" ? undefined : cylinderTextLayout(layer);
  const angles = (layout?.segments ?? slices).map((segment) => segment.angle);
  return {
    slices,
    layout,
    bands: cylinderBackBlurBands(
      angles,
      layer.textEffect?.type === "cylinder" ? layer.textEffect.backBlur : 0,
    ),
  };
}

function CylinderText({
  layer,
  index,
  prefix,
  fontFamily,
  hidden,
  color = layer.color,
  blendMode,
  textureShade = 0,
  bandIndex,
  geometry,
}: {
  layer: LabelLayer;
  index: number;
  prefix: string;
  fontFamily: (layer: LabelLayer) => string;
  hidden: boolean;
  color?: string;
  blendMode?: TextBlendMode;
  textureShade?: number;
  bandIndex?: number;
  geometry?: ReturnType<typeof cylinderGeometry>;
}) {
  const effect = layer.textEffect;
  if (effect?.type !== "cylinder") return null;
  const data = geometry ?? cylinderGeometry(layer);
  if (layer.kind === "circular") {
    const { slices, bands } = data;
    return (
      <g aria-hidden="true" opacity={hidden ? 0 : undefined}>
        {bands.map((band, i) =>
          bandIndex !== undefined && bandIndex !== i ? null : (
            <g
              key={i}
              data-cylinder-blur={
                (bandIndex === undefined && band.blur) || undefined
              }
              style={
                bandIndex === undefined && band.blur
                  ? { filter: `blur(${band.blur}px)` }
                  : undefined
              }
            >
              {band.indices.map((sliceIndex) => {
                const slice = slices[sliceIndex];
                const shading = cylinderShading(
                  slice.angle,
                  effect.backShading,
                );
                return (
                  <g
                    key={sliceIndex}
                    transform={slice.transform}
                    opacity={
                      effect.backFade
                        ? cylinderOpacity(slice.angle, effect.backFade)
                        : undefined
                    }
                  >
                    <g
                      clipPath={`url(#${prefix}-arc-cylinder-${index}-${sliceIndex})`}
                    >
                      <SvgLayerText
                        layer={layer}
                        index={index}
                        prefix={prefix}
                        fontFamily={fontFamily}
                        fill={shadeText(color, shading)}
                        blendMode={blendMode}
                        textureShade={1 - (1 - textureShade) * (1 - shading)}
                      />
                    </g>
                  </g>
                );
              })}
            </g>
          ),
        )}
      </g>
    );
  }
  const { graphemes, segments, anchorOffset } = data.layout!;
  if (!graphemes.length) return null;
  const count = segments.length;
  const bands = data.bands;

  return (
    <g aria-hidden="true" opacity={hidden ? 0 : undefined}>
      {bands.map((band, i) =>
        bandIndex !== undefined && bandIndex !== i ? null : (
          <g
            key={i}
            data-cylinder-blur={
              (bandIndex === undefined && band.blur) || undefined
            }
            style={
              bandIndex === undefined && band.blur
                ? { filter: `blur(${band.blur}px)` }
                : undefined
            }
          >
            {band.indices.map((segmentIndex) => {
              const segment = segments[segmentIndex];
              const start = Math.floor(
                (segmentIndex * graphemes.length) / count,
              );
              const end = Math.floor(
                ((segmentIndex + 1) * graphemes.length) / count,
              );
              const portion = graphemes.slice(start, end).join("");
              const shading = cylinderShading(
                segment.angle,
                effect.backShading,
              );
              const combinedShade = 1 - (1 - textureShade) * (1 - shading);
              return (
                <SvgLayerText
                  key={segmentIndex}
                  layer={layer}
                  index={index}
                  prefix={prefix}
                  fontFamily={fontFamily}
                  text={portion}
                  x={0}
                  y={0}
                  transform={`translate(${layer.x + anchorOffset + segment.x} ${layer.y + segment.y}) matrix(${segment.horizontalScale} ${segment.shear} 0 ${segment.verticalScale} 0 0)`}
                  fontSize={layer.size * segment.scale}
                  fill={shadeText(color, shading)}
                  opacity={
                    effect.backFade
                      ? cylinderOpacity(segment.angle, effect.backFade)
                      : undefined
                  }
                  textAnchor="middle"
                  blendMode={blendMode}
                  textureShade={combinedShade}
                />
              );
            })}
          </g>
        ),
      )}
    </g>
  );
}

function ExtrudedText({
  layer,
  index,
  prefix,
  fontFamily,
  hidden,
}: {
  layer: LabelLayer;
  index: number;
  prefix: string;
  fontFamily: (layer: LabelLayer) => string;
  hidden: boolean;
}) {
  const extrusion = textExtrusion(layer.textEffect);
  if (!extrusion) return null;
  const steps =
    layer.textEffect?.type === "cylinder"
      ? Math.min(
          extrusion.steps,
          cylinderExtrusionSteps(layer.textEffect.segments),
        )
      : extrusion.steps;
  const angle = (extrusion.angle * Math.PI) / 180;
  const geometry =
    layer.textEffect?.type === "cylinder" ? cylinderGeometry(layer) : undefined;
  const backBands = geometry?.bands ?? [{ blur: 0, indices: [] }];
  return (
    <g aria-hidden="true" opacity={hidden ? 0 : undefined}>
      {extrusionBlurBands(steps, extrusion.depthBlur).map((band, bandIndex) => (
        <g key={bandIndex} data-extrusion-blur={band.blur || undefined}>
          {backBands.map((backBand, backIndex) => (
            <g
              key={backIndex}
              data-cylinder-blur={backBand.blur || undefined}
              style={
                band.blur || backBand.blur
                  ? {
                      filter: `blur(${Math.hypot(band.blur, backBand.blur)}px)`,
                    }
                  : undefined
              }
            >
              {band.steps.map((step) => {
                const distance = (extrusion.depth * step) / steps;
                const depthShading = (0.55 * step) / steps;
                const color = shadeText(layer.color, depthShading);
                return (
                  <g
                    key={step}
                    opacity={extrusionOpacity(step, steps, extrusion.fade)}
                    transform={`translate(${Math.cos(angle) * distance} ${-Math.sin(angle) * distance})`}
                  >
                    {layer.textEffect?.type === "cylinder" ? (
                      <CylinderText
                        layer={layer}
                        index={index}
                        prefix={prefix}
                        fontFamily={fontFamily}
                        hidden={false}
                        color={color}
                        blendMode="normal"
                        textureShade={depthShading}
                        bandIndex={backIndex}
                        geometry={geometry}
                      />
                    ) : (
                      <SvgLayerText
                        layer={layer}
                        index={index}
                        prefix={prefix}
                        fontFamily={fontFamily}
                        fill={color}
                        blendMode="normal"
                        textureShade={depthShading}
                      />
                    )}
                  </g>
                );
              })}
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

export function LabelArtwork({
  design,
  side,
  surface = "cookie",
  prefix,
  fontFamily,
  selected,
  selectedIds,
  hiddenTextId,
  hiddenTextIds,
  guides = false,
  bleed = false,
  whiteCenter = false,
  cutCenter = true,
  innerShadow = false,
  finishMode = "preview",
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  design: LabelDesign;
  side: LabelSide;
  surface?: "cookie" | "sleeve";
  prefix: string;
  fontFamily: (layer: LabelLayer) => string;
  selected?: string;
  selectedIds?: ReadonlySet<string>;
  hiddenTextId?: string;
  hiddenTextIds?: ReadonlySet<string>;
  guides?: boolean;
  bleed?: boolean;
  whiteCenter?: boolean;
  cutCenter?: boolean;
  innerShadow?: boolean;
  finishMode?: "preview" | "flat" | "mask" | "base";
  onSelect?: (layer: LabelLayer) => void;
  onPointerDown?: PointerEventHandler<SVGGElement>;
  onPointerMove?: PointerEventHandler<SVGGElement>;
  onPointerUp?: PointerEventHandler<SVGGElement>;
}) {
  // Both surfaces share all text, image and effect rendering.
  const finishMask = finishMode === "mask";
  const artworkLayers = getSurfaceLayers(design, surface, side)
    .filter(layer => finishMode !== "base" || !textFoilColor(layer))
    .map(layer => textFoilColor(layer) ? {...layer, textTexture: undefined,
      blendMode: "normal" as const,
      opacity: 1, blur: 0,
      textEffect: undefined,
      color: finishMode === "mask" ? "#ffffff" :
        finishMode === "flat" ? textFoilColor(layer)! : `url(#${prefix}-foil-${layer.id})`,
    } : layer);
  const extra = bleed ? (design.bleedMm / design.diameterMm) * 600 : 0;
  const hole = (design.holeMm / design.diameterMm) * 300;
  const safe = 300 - (design.safeMm / design.diameterMm) * 600;
  const imageFilterEntries = [
    ...artworkLayers.map((layer) => ({
      layer,
      id: `${prefix}-image-color-${layer.id}`,
    })),
    ...getSurfaceLayers(design, "sleeve", side).map((layer) => ({
      layer,
      id: `${prefix}-sleeve-image-color-${layer.id}`,
    })),
  ];
  return (
    <svg
      className={surface === "sleeve" ? "dc-sleeve-artwork" : "dc-disc"}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-extra} ${-extra} ${600 + extra * 2} ${600 + extra * 2}`}
      width={`${design.diameterMm + (bleed ? design.bleedMm * 2 : 0)}mm`}
      height={`${design.diameterMm + (bleed ? design.bleedMm * 2 : 0)}mm`}
      role={onSelect ? "group" : "img"}
      aria-label={`${design.title}, side ${side}`}
    >
      <defs>
        {artworkLayers.filter(layer => layer.kind === "image" && textFoilColor(layer) && layer.image).map(layer => (
          <mask key={`foil-image-${layer.id}`} id={`${prefix}-foil-image-${layer.id}`} maskUnits="userSpaceOnUse"
            x={layer.x - layer.width / 2} y={layer.y - layer.width / (layer.imageRatio ?? 1) / 2}
            width={layer.width} height={layer.width / (layer.imageRatio ?? 1)} style={{maskType: "alpha"}}>
            <image href={layer.image} x={layer.x - layer.width / 2} y={layer.y - layer.width / (layer.imageRatio ?? 1) / 2}
              width={layer.width} height={layer.width / (layer.imageRatio ?? 1)} preserveAspectRatio="xMidYMid meet" />
          </mask>
        ))}
        {finishMode === "mask" && <>
          <filter id={`${prefix}-foil-white`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" /></filter>
          <filter id={`${prefix}-foil-black`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        </>}
        {finishMode === "preview" && getSurfaceLayers(design, surface, side).filter(layer => textFoilColor(layer)).map(layer => (
          <linearGradient key={layer.id} id={`${prefix}-foil-${layer.id}`} x1="0" y1="0" x2=".8" y2="1">
            <stop offset="0%" stopColor={textFoilColor(layer)!} />
            <stop offset="18%" stopColor="#ffffff" />
            <stop offset="28%" stopColor={textFoilColor(layer)!} />
            <stop offset="34%" stopColor="#979ba3" />
            <stop offset="40%" stopColor={textFoilColor(layer)!} />
            <stop offset="48%" stopColor="#ffffff" />
            <stop offset="56%" stopColor={textFoilColor(layer)!} />
            <stop offset="63%" stopColor="#979ba3" />
            <stop offset="70%" stopColor={textFoilColor(layer)!} />
            <stop offset="82%" stopColor="#ffffff" />
            <stop offset="90%" stopColor={textFoilColor(layer)!} />
            <stop offset="100%" stopColor={textFoilColor(layer)!} />
          </linearGradient>
        ))}
        {innerShadow && (
          <radialGradient
            id={`${prefix}-cookie-inner-shadow`}
            cx="50.5%"
            cy="50.5%"
            r="50%"
          >
            <stop offset="95%" stopColor="#161a14" stopOpacity="0" />
            <stop offset="97%" stopColor="#161a14" stopOpacity="0.015" />
            <stop offset="99%" stopColor="#161a14" stopOpacity="0.065" />
            <stop offset="100%" stopColor="#161a14" stopOpacity="0.21" />
          </radialGradient>
        )}
        {artworkLayers.map((layer, index) =>
          layer.kind !== "image" && layer.textTexture ? (
            <pattern
              key={`${layer.id}-text-surface`}
              id={`${prefix}-text-surface-${index}`}
              patternUnits="userSpaceOnUse"
              width={(600 * (layer.textTextureScale ?? 100)) / 100}
              height={(600 * (layer.textTextureScale ?? 100)) / 100}
            >
              <image
                href={layer.textTexture}
                x="0"
                y="0"
                width={(600 * (layer.textTextureScale ?? 100)) / 100}
                height={(600 * (layer.textTextureScale ?? 100)) / 100}
                preserveAspectRatio="xMidYMid slice"
                opacity={layer.textTextureOpacity ?? 1}
              />
            </pattern>
          ) : null,
        )}
        {artworkLayers.flatMap((layer, index) =>
          circularCylinderSlices(layer).map((slice, sliceIndex) => (
            <clipPath
              key={`${layer.id}-cylinder-${sliceIndex}`}
              id={`${prefix}-arc-cylinder-${index}-${sliceIndex}`}
              clipPathUnits="userSpaceOnUse"
            >
              <rect x={slice.x} y={-6000} width={slice.width} height={12000} />
            </clipPath>
          )),
        )}
        {imageFilterEntries
          .filter(
            ({ layer }) =>
              layer.kind === "image" &&
              (layer.imageFill ||
                (imageRole(layer) === "brand-logo" && layer.imageInverted) ||
                imageRole(layer) === "barcode"),
          )
          .map(({ layer, id }) => (
            <filter key={id} id={id} colorInterpolationFilters="sRGB">
              {layer.imageFill ? (
                <>
                  <feFlood floodColor={layer.imageFill} />
                  <feComposite in2="SourceAlpha" operator="in" />
                </>
              ) : imageRole(layer) === "barcode" ? (
                <>
                  <feColorMatrix
                    in="SourceGraphic"
                    result="barcode-source"
                    type="matrix"
                    values={barcodeSourceMatrix(layer.imageBarSource)}
                  />
                  <feComponentTransfer in="barcode-source">
                    <feFuncR
                      type="table"
                      tableValues={`${parseInt((layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000").slice(1, 3), 16) / 255} ${parseInt((layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff").slice(1, 3), 16) / 255}`}
                    />
                    <feFuncG
                      type="table"
                      tableValues={`${parseInt((layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000").slice(3, 5), 16) / 255} ${parseInt((layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff").slice(3, 5), 16) / 255}`}
                    />
                    <feFuncB
                      type="table"
                      tableValues={`${parseInt((layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000").slice(5, 7), 16) / 255} ${parseInt((layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff").slice(5, 7), 16) / 255}`}
                    />
                  </feComponentTransfer>
                </>
              ) : (
                <feComponentTransfer>
                  <feFuncR type="table" tableValues="1 0" />
                  <feFuncG type="table" tableValues="1 0" />
                  <feFuncB type="table" tableValues="1 0" />
                </feComponentTransfer>
              )}
            </filter>
          ))}
        {artworkLayers
          .filter(
            (layer) =>
              layer.kind === "image" && (layer.imageCrop || layer.borderRadius),
          )
          .map((layer) => {
            return (
              <clipPath
                key={`crop-${layer.id}`}
                id={`${prefix}-image-crop-${layer.id}`}
                clipPathUnits="userSpaceOnUse"
              >
                <rect {...imageCropBounds(layer)} />
              </clipPath>
            );
          })}
        {artworkLayers.map(
          (layer, index) =>
            layer.kind !== "image" &&
            !!layer.inkBleed && (
              <InkBleedFilter
                key={layer.id}
                id={`${prefix}-ink-bleed-${index}`}
                amount={layer.inkBleed}
              />
            ),
        )}
        <clipPath id={`${prefix}-trim`}>
          {surface === "sleeve" ? <rect width="600" height="600" /> : cutCenter ? <path
            clipRule="evenodd"
            fillRule="evenodd"
            stroke="none"
            d={`M${300 - (300 + extra)} 300a${300 + extra} ${300 + extra} 0 1 0 ${2 * (300 + extra)} 0a${300 + extra} ${300 + extra} 0 1 0 ${-2 * (300 + extra)} 0Z M${300 - hole} 300a${hole} ${hole} 0 1 0 ${2 * hole} 0a${hole} ${hole} 0 1 0 ${-2 * hole} 0Z`}
          /> : <circle cx="300" cy="300" r={300 + extra} />}
        </clipPath>
        {artworkLayers.map(
          (layer, index) =>
            layer.kind === "circular" && (
              <path
                key={layer.id}
                id={`${prefix}-arc-${index}`}
                d={circularPath(layer)}
              />
            ),
        )}
      </defs>
      {whiteCenter && <circle cx="300" cy="300" r={hole} fill="#ffffff" />}
      <g
        clipPath={`url(#${prefix}-trim)`}
        fontFamily="Alte DIN Input"
        fontWeight="400"
      >
        {surface === "cookie" && !finishMask && <circle cx="300" cy="300" r={300 + extra} fill={design.paper} />}
        {surface === "cookie" && !finishMask && design.frame && (
          <circle
            cx="300"
            cy="300"
            r="278"
            fill="none"
            stroke="#20211e"
            strokeWidth=".65"
          />
        )}
        {/* {design.mark && (
          <g fill="none" stroke="#20211e" strokeWidth="1">
            <path d="M 274 109 H 326 M 300 98 V 120" />
            <circle cx="300" cy="109" r="7" />
          </g>
        )} */}
        {artworkLayers.map((layer, index) =>
          !layer.visible ? null : (
            <g
              key={layer.id}
              data-layer-id={layer.id}
              filter={finishMode === "mask" ? `url(#${prefix}-foil-${textFoilColor(layer) ? "white" : "black"})` : undefined}
              className={onSelect ? "dc-svg-element" : undefined}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={onSelect ? `Edit ${layer.name}` : undefined}
              onClick={() => onSelect?.(layer)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(layer);
                }
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onLostPointerCapture={onPointerUp}
              transform={
                layer.kind === "circular"
                  ? `rotate(${layer.angle} 300 300)`
                  : `rotate(${layer.angle} ${layer.x} ${layer.y})`
              }
            >
              {guides &&
                (selectedIds
                  ? selectedIds.has(layer.id)
                  : layer.id === selected) &&
                (layer.kind === "circular" ? (
                  <circle
                    cx="300"
                    cy="300"
                    r={layer.radius}
                    className="dc-arc-selection-guide"
                  />
                ) : layer.kind === "image" ? (
                  <rect
                    x={layer.x - layer.width / 2}
                    y={layer.y - layer.width / (layer.imageRatio ?? 1) / 2}
                    width={layer.width}
                    height={layer.width / (layer.imageRatio ?? 1)}
                    className="dc-selection-guide"
                  />
                ) : (
                  <TextSelectionGuide
                    revision={JSON.stringify([layer, fontFamily(layer)])}
                  />
                ))}
              <g
                data-layer-appearance="true"
                opacity={layer.opacity ?? 1}
                style={
                  layer.blur
                    ? {
                        filter: `blur(${layer.blur}px)`,
                        mixBlendMode:
                          layer.blendMode === "difference"
                            ? "difference"
                            : undefined,
                      }
                    : undefined
                }
              >
                {layer.kind === "image" ? (
                  layer.image && (
                    <g
                      clipPath={
                        layer.imageCrop || layer.borderRadius
                          ? `url(#${prefix}-image-crop-${layer.id})`
                          : undefined
                      }
                    >
                      {textFoilColor(layer) ? <rect
                        x={layer.x - layer.width / 2}
                        y={layer.y - layer.width / (layer.imageRatio ?? 1) / 2}
                        width={layer.width} height={layer.width / (layer.imageRatio ?? 1)}
                        fill={layer.color} mask={`url(#${prefix}-foil-image-${layer.id})`}
                      /> : <image
                        filter={
                          layer.imageFill ||
                          (imageRole(layer) === "brand-logo" &&
                            layer.imageInverted) ||
                          imageRole(layer) === "barcode"
                            ? `url(#${prefix}-image-color-${layer.id})`
                            : undefined
                        }
                        href={layer.image}
                        x={layer.x - layer.width / 2}
                        y={layer.y - layer.width / (layer.imageRatio ?? 1) / 2}
                        width={layer.width}
                        height={layer.width / (layer.imageRatio ?? 1)}
                        preserveAspectRatio="xMidYMid meet"
                      />}
                    </g>
                  )
                ) : (
                  <>
                    <ExtrudedText
                      layer={layer}
                      index={index}
                      prefix={prefix}
                      fontFamily={fontFamily}
                      hidden={layer.id === hiddenTextId || hiddenTextIds?.has(layer.id) === true}
                    />
                    {layer.textEffect?.type === "cylinder" ? (
                      <CylinderText
                        layer={layer}
                        index={index}
                        prefix={prefix}
                        fontFamily={fontFamily}
                        hidden={layer.id === hiddenTextId || hiddenTextIds?.has(layer.id) === true}
                      />
                    ) : (
                      <SvgLayerText
                        layer={layer}
                        index={index}
                        prefix={prefix}
                        fontFamily={fontFamily}
                        opacity={layer.id === hiddenTextId || hiddenTextIds?.has(layer.id) ? 0 : undefined}
                        filter={
                          layer.inkBleed
                            ? `url(#${prefix}-ink-bleed-${index})`
                            : undefined
                        }
                      />
                    )}
                  </>
                )}
              </g>
            </g>
          ),
        )}
        {innerShadow && (
          <circle
            cx="300"
            cy="300"
            r={300 + extra}
            fill={`url(#${prefix}-cookie-inner-shadow)`}
            pointerEvents="none"
          />
        )}
      </g>
      {guides && surface === "cookie" && (
        <g className="dc-print-guides">
          <circle cx="300" cy="300" r={safe} />
          <path d="M 300 282 V 318 M 282 300 H 318" />
        </g>
      )}
    </svg>
  );
}
