import {TypographyValueControl} from "./TypographyValueControl";
import type {ObiBand, ObiBands} from "./obi-elevation";

export const defaultObiBand: ObiBand = {enabled: false, start: 0, width: 12, heightMm: 0.25};

export function ObiControls({bands, side, onSide, onChange, onCommit}: {
  bands?: ObiBands;
  side: "A" | "B";
  onSide: (side: "A" | "B") => void;
  onChange: (side: "A" | "B", patch: Partial<ObiBand>, group?: string) => void;
  onCommit: () => void;
}) {
  const band = bands?.[side] ?? defaultObiBand;
  return <section className="dc-obi-controls" aria-label="OBI elevation">
    <div className="dc-obi-heading"><strong>OBI elevation</strong><small>Experimental</small></div>
    <div className="dc-obi-sides" role="group" aria-label="OBI side">
      {(["A", "B"] as const).map(value => <button type="button" key={value}
        aria-pressed={side === value} onClick={() => onSide(value)}>{value} side</button>)}
    </div>
    <label className="dc-obi-enable"><span>Raised band</span><input type="checkbox" checked={band.enabled}
      onChange={event => {onCommit(); onChange(side, {enabled: event.target.checked}); onCommit();}} /></label>
    <div className="dc-obi-placement" role="group" aria-label="OBI placement">
      {(["Left", "Center", "Right"] as const).map(value => <button key={value} type="button"
        onClick={() => {onCommit(); onChange(side, {start: value === "Left" ? 0 : value === "Right" ? 100 - band.width : (100 - band.width) / 2}); onCommit();}}>{value}</button>)}
    </div>
    <div className="dc-field-pair">
      <TypographyValueControl label="From left" unit="%" value={band.start} min={0} max={99} step={0.5}
        onChange={start => onChange(side, {start}, `obi-start-${side}`)} onCommit={onCommit} />
      <TypographyValueControl label="Width" unit="%" value={band.width} min={1} max={100 - band.start} step={0.5}
        onChange={width => onChange(side, {width}, `obi-width-${side}`)} onCommit={onCommit} />
    </div>
    <TypographyValueControl label="Elevation" unit="MM" value={band.heightMm} min={0} max={0.5} step={0.01}
      onChange={heightMm => onChange(side, {heightMm}, `obi-height-${side}`)} onCommit={onCommit} />
  </section>;
}
