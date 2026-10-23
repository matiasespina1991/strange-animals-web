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
}) {
  const activeBlendMode = blendMode ?? layer.blendMode;
  const closedArc = layer.kind === "circular" && layer.textEffect?.type === "cylinder" && layer.textEffect.closed;
  return (
    <text
      transform={transform}
      filter={filter}
      fill={activeBlendMode === "difference" ? "#ffffff" : fill}
      fillOpacity={opacity}
      fontSize={fontSize}
      letterSpacing={layer.spacing}
      fontFamily={fontFamily(layer)}
      textAnchor={closedArc ? "start" : textAnchor}
      textLength={closedArc ? 2 * Math.PI * layer.radius : textLength}
      lengthAdjust={closedArc || textLength ? "spacingAndGlyphs" : undefined}
      style={
        activeBlendMode === "difference"
          ? { mixBlendMode: "difference" }
          : undefined
      }
      xmlSpace="preserve"
      {...(layer.kind === "circular" ? {} : { x, y })}
    >
      {layer.kind === "circular" ? (
        <textPath
          href={`#${prefix}-arc-${index}`}
          startOffset={
            closedArc ? "0%" : layer.align === "middle"
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
  const layout = layer.kind === "circular" ? undefined : cylinderTextLayout(layer);
  const angles = (layout?.segments ?? slices).map(segment => segment.angle);
  return { slices, layout, bands: cylinderBackBlurBands(angles, layer.textEffect?.type === "cylinder" ? layer.textEffect.backBlur : 0) };
}

function CylinderText({
  layer,
  index,
  prefix,
  fontFamily,
  hidden,
  color = layer.color,
  blendMode,
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
  bandIndex?: number;
  geometry?: ReturnType<typeof cylinderGeometry>;
}) {
  const effect = layer.textEffect;
  if (effect?.type !== "cylinder") return null;
  const data = geometry ?? cylinderGeometry(layer);
  if (layer.kind === "circular") {
    const { slices, bands } = data;
    return <g aria-hidden="true" opacity={hidden ? 0 : undefined}>
      {bands.map((band, i) => bandIndex !== undefined && bandIndex !== i ? null :
        <g key={i} data-cylinder-blur={bandIndex === undefined && band.blur || undefined}
          style={bandIndex === undefined && band.blur ? { filter: `blur(${band.blur}px)` } : undefined}>
          {band.indices.map(sliceIndex => {
            const slice = slices[sliceIndex];
            return <g key={sliceIndex} transform={slice.transform} opacity={effect.backFade ? cylinderOpacity(slice.angle, effect.backFade) : undefined}>
              <g clipPath={`url(#${prefix}-arc-cylinder-${index}-${sliceIndex})`}>
                <SvgLayerText layer={layer} index={index} prefix={prefix} fontFamily={fontFamily}
                  fill={shadeText(color, cylinderShading(slice.angle, effect.backShading))} blendMode={blendMode} />
              </g>
            </g>;
          })}
        </g>)}
    </g>;
  }
  const { graphemes, segments, anchorOffset } = data.layout!;
  if (!graphemes.length) return null;
  const count = segments.length;
  const bands = data.bands;

  return (
    <g aria-hidden="true" opacity={hidden ? 0 : undefined}>
      {bands.map((band, i) => bandIndex !== undefined && bandIndex !== i ? null : <g key={i}
        data-cylinder-blur={bandIndex === undefined && band.blur || undefined}
        style={bandIndex === undefined && band.blur ? { filter: `blur(${band.blur}px)` } : undefined}>
      {band.indices.map(segmentIndex => {
        const segment = segments[segmentIndex];
        const start = Math.floor((segmentIndex * graphemes.length) / count);
        const end = Math.floor(((segmentIndex + 1) * graphemes.length) / count);
        const portion = graphemes.slice(start, end).join("");
        const shading = cylinderShading(segment.angle, effect.backShading);
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
            opacity={effect.backFade ? cylinderOpacity(segment.angle, effect.backFade) : undefined}
            textAnchor="middle"
            textLength={segment.width}
            blendMode={blendMode}
          />
        );
      })}</g>)}
    </g>
  );
}

function ExtrudedText({ layer, index, prefix, fontFamily, hidden }: {
  layer: LabelLayer; index: number; prefix: string;
  fontFamily: (layer: LabelLayer) => string; hidden: boolean;
}) {
  const extrusion = textExtrusion(layer.textEffect);
  if (!extrusion) return null;
  const steps = layer.textEffect?.type === "cylinder"
    ? Math.min(extrusion.steps, cylinderExtrusionSteps(layer.textEffect.segments))
    : extrusion.steps;
  const angle = extrusion.angle * Math.PI / 180;
  const geometry = layer.textEffect?.type === "cylinder" ? cylinderGeometry(layer) : undefined;
  const backBands = geometry?.bands ?? [{ blur: 0, indices: [] }];
  return <g aria-hidden="true" opacity={hidden ? 0 : undefined}>
    {extrusionBlurBands(steps, extrusion.depthBlur).map((band, bandIndex) => (
      <g key={bandIndex} data-extrusion-blur={band.blur || undefined}>
        {backBands.map((backBand, backIndex) => <g key={backIndex} data-cylinder-blur={backBand.blur || undefined}
          style={band.blur || backBand.blur ? { filter: `blur(${Math.hypot(band.blur, backBand.blur)}px)` } : undefined}>
        {band.steps.map(step => {
          const distance = extrusion.depth * step / steps;
          const color = shadeText(layer.color, 0.55 * step / steps);
          return <g key={step} opacity={extrusionOpacity(step, steps, extrusion.fade)}
            transform={`translate(${Math.cos(angle) * distance} ${-Math.sin(angle) * distance})`}>
            {layer.textEffect?.type === "cylinder"
              ? <CylinderText layer={layer} index={index} prefix={prefix} fontFamily={fontFamily} hidden={false} color={color} blendMode="normal" bandIndex={backIndex} geometry={geometry} />
              : <SvgLayerText layer={layer} index={index} prefix={prefix} fontFamily={fontFamily} fill={color} blendMode="normal" />}
          </g>;
        })}
        </g>)}
      </g>
    ))}
  </g>;
}

export function LabelArtwork({
  design,
  side,
  prefix,
  fontFamily,
  selected,
  selectedIds,
  hiddenTextId,
  guides = false,
  bleed = false,
  whiteCenter = false,
  previewShadow = false,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  design: LabelDesign;
  side: LabelSide;
  prefix: string;
  fontFamily: (layer: LabelLayer) => string;
  selected?: string;
  selectedIds?: ReadonlySet<string>;
  hiddenTextId?: string;
  guides?: boolean;
  bleed?: boolean;
  whiteCenter?: boolean;
  previewShadow?: boolean;
  onSelect?: (layer: LabelLayer) => void;
  onPointerDown?: PointerEventHandler<SVGGElement>;
  onPointerMove?: PointerEventHandler<SVGGElement>;
  onPointerUp?: PointerEventHandler<SVGGElement>;
}) {
  const extra = bleed ? (design.bleedMm / design.diameterMm) * 600 : 0;
  const hole = (design.holeMm / design.diameterMm) * 300;
  const safe = 300 - (design.safeMm / design.diameterMm) * 600;
  return (
    <svg
      className="dc-disc"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${-extra} ${-extra} ${600 + extra * 2} ${600 + extra * 2}`}
      width={`${design.diameterMm + (bleed ? design.bleedMm * 2 : 0)}mm`}
      height={`${design.diameterMm + (bleed ? design.bleedMm * 2 : 0)}mm`}
      role={onSelect ? "group" : "img"}
      aria-label={`${design.title}, side ${side}`}
    >
      <defs>
        {design[side].flatMap((layer, index) => circularCylinderSlices(layer).map((slice, sliceIndex) =>
          <clipPath key={`${layer.id}-cylinder-${sliceIndex}`} id={`${prefix}-arc-cylinder-${index}-${sliceIndex}`} clipPathUnits="userSpaceOnUse">
            <rect x={slice.x} y={-6000} width={slice.width} height={12000} />
          </clipPath>))}
        {design[side].filter(layer => layer.kind === "image" && (layer.imageFill || (imageRole(layer) === "brand-logo" && layer.imageInverted) || imageRole(layer) === "barcode")).map(layer => (
          <filter key={`image-color-${layer.id}`} id={`${prefix}-image-color-${layer.id}`} colorInterpolationFilters="sRGB">
            {layer.imageFill ? <><feFlood floodColor={layer.imageFill} /><feComposite in2="SourceAlpha" operator="in" /></> : imageRole(layer) === "barcode" ? <>
              <feColorMatrix in="SourceGraphic" result="barcode-source" type="matrix" values={barcodeSourceMatrix(layer.imageBarSource)} />
              <feComponentTransfer in="barcode-source">
                <feFuncR type="table" tableValues={`${parseInt((layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000").slice(1, 3), 16) / 255} ${parseInt((layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff").slice(1, 3), 16) / 255}`} />
                <feFuncG type="table" tableValues={`${parseInt((layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000").slice(3, 5), 16) / 255} ${parseInt((layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff").slice(3, 5), 16) / 255}`} />
                <feFuncB type="table" tableValues={`${parseInt((layer.imageBarColor ?? layer.imageBarSource?.bars ?? "#000000").slice(5, 7), 16) / 255} ${parseInt((layer.imageBarBackground ?? layer.imageBarSource?.background ?? "#ffffff").slice(5, 7), 16) / 255}`} />
              </feComponentTransfer>
            </> : <feComponentTransfer><feFuncR type="table" tableValues="1 0" /><feFuncG type="table" tableValues="1 0" /><feFuncB type="table" tableValues="1 0" /></feComponentTransfer>}
          </filter>
        ))}
        {design[side].filter(layer => layer.kind === "image" && (layer.imageCrop || layer.borderRadius)).map(layer => {
          return <clipPath key={`crop-${layer.id}`} id={`${prefix}-image-crop-${layer.id}`} clipPathUnits="userSpaceOnUse">
            <rect {...imageCropBounds(layer)} />
          </clipPath>;
        })}
        {design[side].map(
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
        <mask
          id={`${prefix}-hole`}
          x={-extra}
          y={-extra}
          width={600 + extra * 2}
          height={600 + extra * 2}
          maskUnits="userSpaceOnUse"
        >
          <rect
            x={-extra}
            y={-extra}
            width={600 + extra * 2}
            height={600 + extra * 2}
            fill="white"
          />
          <circle cx="300" cy="300" r={hole} fill="black" />
        </mask>
        <clipPath id={`${prefix}-trim`}>
          <circle cx="300" cy="300" r={300 + extra} />
        </clipPath>
        {design[side].map(
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
      {previewShadow && (
        <circle
          cx="300"
          cy="300"
          r={300 + extra}
          fill={design.paper}
          className="dc-label-shadow"
        />
      )}
      {whiteCenter && <circle cx="300" cy="300" r={hole} fill="#ffffff" />}
      <g
        mask={`url(#${prefix}-hole)`}
        clipPath={`url(#${prefix}-trim)`}
        fontFamily="Alte DIN Input"
        fontWeight="400"
      >
        <circle cx="300" cy="300" r={300 + extra} fill={design.paper} />
        {design.frame && (
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
        {design[side].map((layer, index) =>
          !layer.visible ? null : (
            <g
              key={layer.id}
              data-layer-id={layer.id}
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
                    className="dc-selection-guide"
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
              <g data-layer-appearance="true" opacity={layer.opacity ?? 1} style={layer.blur ? { filter: `blur(${layer.blur}px)`, mixBlendMode: layer.blendMode === "difference" ? "difference" : undefined } : undefined}>
              {layer.kind === "image" ? (
                layer.image && (
                  <g clipPath={layer.imageCrop || layer.borderRadius ? `url(#${prefix}-image-crop-${layer.id})` : undefined}>
                  <image
                    filter={layer.imageFill || (imageRole(layer) === "brand-logo" && layer.imageInverted) || imageRole(layer) === "barcode" ? `url(#${prefix}-image-color-${layer.id})` : undefined}
                    href={layer.image}
                    x={layer.x - layer.width / 2}
                    y={layer.y - layer.width / (layer.imageRatio ?? 1) / 2}
                    width={layer.width}
                    height={layer.width / (layer.imageRatio ?? 1)}
                    preserveAspectRatio="xMidYMid meet"
                  />
                  </g>
                )
              ) : (
                <>
                  <ExtrudedText layer={layer} index={index} prefix={prefix} fontFamily={fontFamily} hidden={layer.id === hiddenTextId} />
                  {layer.textEffect?.type === "cylinder" ? (
                    <CylinderText layer={layer} index={index} prefix={prefix} fontFamily={fontFamily} hidden={layer.id === hiddenTextId} />
                  ) : <SvgLayerText
                    layer={layer}
                    index={index}
                    prefix={prefix}
                    fontFamily={fontFamily}
                    opacity={layer.id === hiddenTextId ? 0 : undefined}
                    filter={
                      layer.inkBleed
                        ? `url(#${prefix}-ink-bleed-${index})`
                        : undefined
                    }
                  />}
                </>
              )}
              </g>
            </g>
          ),
        )}
      </g>
      {guides && (
        <g className="dc-print-guides">
          <circle cx="300" cy="300" r={safe} />
          <circle cx="300" cy="300" r={hole} />
          <path d="M 300 282 V 318 M 282 300 H 318" />
        </g>
      )}
    </svg>
  );
}
