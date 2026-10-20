import type { PathCommand } from "opentype.js";
import type { BezierKnot, BezierPath } from "ag-psd";

/** Convert glyph contours to Photoshop cubic Bezier knots, in document pixels. */
export function psdPaths(commands: PathCommand[], project: (x: number, y: number) => [number, number]): BezierPath[] {
  const paths: BezierPath[] = [];
  let knots: BezierKnot[] = [];
  let previous: [number, number] = [0, 0];
  const point = (x: number, y: number) => project(x, y);
  const finish = () => {
    if (knots.length > 1) {
      const first = knots[0], last = knots.at(-1)!;
      if (first.points[2] === last.points[2] && first.points[3] === last.points[3]) {
        first.points[0] = last.points[0]; first.points[1] = last.points[1]; knots.pop();
      }
      paths.push({ open: false, fillRule: "non-zero", knots });
    }
    knots = [];
  };
  for (const command of commands) {
    if (command.type === "M") {
      finish(); previous = [command.x, command.y];
      const anchor = point(...previous);
      knots.push({ linked: false, points: [...anchor, ...anchor, ...anchor] });
    } else if (command.type === "Z") finish();
    else if (knots.length) {
      const end: [number, number] = [command.x, command.y];
      const anchor = point(...end);
      let incoming = anchor;
      if (command.type === "C") {
        knots.at(-1)!.points.splice(4, 2, ...point(command.x1, command.y1));
        incoming = point(command.x2, command.y2);
      } else if (command.type === "Q") {
        knots.at(-1)!.points.splice(4, 2, ...point(previous[0] + 2 / 3 * (command.x1 - previous[0]), previous[1] + 2 / 3 * (command.y1 - previous[1])));
        incoming = point(end[0] + 2 / 3 * (command.x1 - end[0]), end[1] + 2 / 3 * (command.y1 - end[1]));
      }
      knots.push({ linked: false, points: [...incoming, ...anchor, ...anchor] });
      previous = end;
    }
  }
  finish();
  return paths;
}
