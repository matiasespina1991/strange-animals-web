import type { PointerEventHandler } from "react";
import { TextSelectionGuide } from "./TextSelectionGuide";
import {
  circularPath,
  type LabelDesign,
  type LabelLayer,
  type LabelSide,
} from "./design-configurator-model";

export function LabelArtwork({
  design,
  side,
  prefix,
  fontFamily,
  selected,
  guides = false,
  bleed = false,
  whiteCenter = false,
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
  guides?: boolean;
  bleed?: boolean;
  whiteCenter?: boolean;
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
                layer.id === selected &&
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
                  <TextSelectionGuide revision={JSON.stringify([layer, fontFamily(layer)])} />
                ))}
              {layer.kind === "image" ? (
                layer.image && (
                  <image
                    opacity={layer.opacity ?? 1}
                    href={layer.image}
                    x={layer.x - layer.width / 2}
                    y={layer.y - layer.width / (layer.imageRatio ?? 1) / 2}
                    width={layer.width}
                    height={layer.width / (layer.imageRatio ?? 1)}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )
              ) : (
                <text
                  fill={layer.color}
                  fontSize={layer.size}
                  letterSpacing={layer.spacing}
                  fontFamily={fontFamily(layer)}
                  textAnchor={layer.align}
                  {...(layer.kind === "circular"
                    ? {}
                    : { x: layer.x, y: layer.y })}
                >
                  {layer.kind === "circular" ? (
                    <textPath
                      href={`#${prefix}-arc-${index}`}
                      startOffset={
                        layer.align === "middle"
                          ? "50%"
                          : layer.align === "end"
                            ? "100%"
                            : "0%"
                      }
                    >
                      {layer.text.replace(/\n/g, " ")}
                    </textPath>
                  ) : (
                    layer.text.split("\n").map((line, i) => (
                      <tspan key={i} x={layer.x} dy={i ? "1.1em" : 0}>
                        {line || "\u00a0"}
                      </tspan>
                    ))
                  )}
                </text>
              )}
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
