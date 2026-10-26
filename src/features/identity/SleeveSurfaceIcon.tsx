import { Circle, Square } from "lucide-react";

export function SleeveSurfaceIcon({ size = 15 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-grid",
        width: size,
        height: size,
        flex: "0 0 auto",
        placeItems: "center",
        lineHeight: 0,
      }}
    >
      <Square
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          strokeWidth: 2,
        }}
      />
      <Circle
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "52%",
          height: "52%",
          transform: "translate(-50%, -50%)",
          strokeWidth: 2.4,
        }}
      />
    </span>
  );
}