import {
  ArrowDown,
  ChevronDown,
  Focus,
  Layers,
  Rotate3D,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import "./text-effects-lab.css";

type Field = { label: string; value: string; unit?: string; position?: number };
const geometry: Field[] = [
  { label: "Tilt", value: "−45", unit: "°", position: 20 },
  { label: "Rotation", value: "100", unit: "°", position: 28 },
  { label: "Radius", value: "295", unit: "PX", position: 100 },
  { label: "Max arc", value: "180", unit: "°", position: 100 },
  { label: "Segments", value: "15", position: 25 },
];
const closedGeometry = geometry.filter((field) => field.label !== "Max arc");
const surface: Field[] = [
  { label: "Back blur", value: "11.1", unit: "PX", position: 28 },
  { label: "Back shading", value: "100", unit: "%", position: 100 },
  { label: "Back transparency", value: "100", unit: "%", position: 100 },
];
const depth: Field[] = [
  { label: "Depth", value: "195", unit: "PX", position: 49 },
  { label: "Direction", value: "45", unit: "°", position: 13 },
  { label: "Steps", value: "9", position: 8 },
  { label: "Fade", value: "100", unit: "%", position: 100 },
  { label: "Depth blur", value: "0", unit: "PX", position: 3 },
];

function StaticSwitch({ label, on = true }: { label: string; on?: boolean }) {
  return (
    <div className="tel-switch-row">
      <span className={`tel-switch ${on ? "is-on" : ""}`} aria-hidden="true">
        <i />
      </span>
      <b>{label}</b>
    </div>
  );
}

function StaticField({
  field,
  compact = false,
  rail = true,
}: {
  field: Field;
  compact?: boolean;
  rail?: boolean;
}) {
  return (
    <div className={`tel-field ${compact ? "is-compact" : ""}`}>
      <div className="tel-field-heading">
        <span>{field.label}</span>
        {field.unit && <small>{field.unit}</small>}
      </div>
      <div className="tel-value">{field.value}</div>
      {rail && (
        <div className="tel-rail">
          <i style={{ width: `${field.position ?? 50}%` }} />
          <b style={{ left: `${field.position ?? 50}%` }} />
        </div>
      )}
    </div>
  );
}

function FieldGrid({
  fields,
  compact = false,
  className = "",
}: {
  fields: Field[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`tel-fields ${compact ? "is-compact" : ""} ${className}`}>
      {fields.map((field) => (
        <StaticField key={field.label} field={field} compact={compact} />
      ))}
    </div>
  );
}

function Group({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tel-group ${className}`}>
      <header>
        {icon}
        {title}
        <ChevronDown size={15} />
      </header>
      {children}
    </section>
  );
}

function EffectBlock({
  title,
  count,
  children,
  compact = false,
}: {
  title: string;
  count: string;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`tel-effect ${compact ? "is-compact" : ""}`}>
      <header>
        <StaticSwitch label={title} />
        <span>{count}</span>
      </header>
      {children}
    </section>
  );
}

function CylinderMode({ arc = "360°" }: { arc?: string }) {
  return (
    <div className="tel-mode">
      <span className="is-active">Cylinder</span>
      <span>Extrusion</span>
      <b>{arc}</b>
    </div>
  );
}

const panels: { title: string; tag: string; content: ReactNode }[] = [
  {
    title: "Acordeones abiertos",
    tag: "01 / STACK",
    content: (
      <>
        <EffectBlock title="Cylinder" count="ON">
          <div className="tel-state">
            Closed <span>360°</span>
          </div>
          <FieldGrid fields={closedGeometry} />
          <Group title="Back surface" icon={<Focus size={15} />}>
            <FieldGrid fields={surface} compact />
          </Group>
        </EffectBlock>
        <EffectBlock title="Extrusion" count="ON">
          <FieldGrid fields={depth} compact />
        </EffectBlock>
      </>
    ),
  },
  {
    title: "Selector segmentado",
    tag: "02 / MODE",
    content: (
      <>
        <CylinderMode arc="150°" />
        <div className="tel-mode-body">
          <StaticSwitch label="Cylinder" />
          <div className="tel-state">
            Open arc <span>150°</span>
          </div>
          <FieldGrid fields={geometry} />
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
          <EffectBlock title="Extrusion" count="ON">
            <FieldGrid fields={depth} compact />
          </EffectBlock>
        </div>
      </>
    ),
  },
  {
    title: "Dos módulos equivalentes",
    tag: "03 / PARALLEL",
    content: (
      <div className="tel-two-columns">
        <EffectBlock title="Cylinder" count="ON">
          <div className="tel-state">
            Closed <span>360°</span>
          </div>
          <FieldGrid fields={closedGeometry} compact />
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
        </EffectBlock>
        <EffectBlock title="Extrusion" count="ON">
          <FieldGrid fields={depth} compact />
        </EffectBlock>
      </div>
    ),
  },
  {
    title: "Geometría al frente",
    tag: "04 / SIDEBAR",
    content: (
      <div className="tel-sidebar-layout">
        <nav>
          <span className="is-active">
            <Rotate3D size={16} />
            Cylinder
          </span>
          <span>
            <Layers size={16} />
            Extrusion
          </span>
          <span>
            <Focus size={16} />
            Surface
          </span>
        </nav>
        <div>
          <StaticSwitch label="Cylinder" />
          <div className="tel-state">
            Closed <span>360°</span>
          </div>
          <FieldGrid fields={closedGeometry} compact />
          <EffectBlock title="Extrusion" count="ON">
            <FieldGrid fields={depth} compact />
          </EffectBlock>
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
        </div>
      </div>
    ),
  },
  {
    title: "Grupos por intención",
    tag: "05 / TASKS",
    content: (
      <>
        <div className="tel-task-grid">
          <Group title="Shape" icon={<Rotate3D size={15} />}>
            <FieldGrid fields={closedGeometry} compact />
          </Group>
          <Group title="Surface" icon={<Focus size={15} />}>
            <FieldGrid fields={surface} compact />
          </Group>
        </div>
        <EffectBlock title="Extrusion" count="ON">
          <FieldGrid fields={depth} compact />
        </EffectBlock>
      </>
    ),
  },
  {
    title: "Controles rápidos + detalle",
    tag: "06 / QUICK",
    content: (
      <>
        <EffectBlock title="Cylinder" count="ON">
          <div className="tel-state">
            Open arc <span>150°</span>
          </div>
          <div className="tel-quick-grid">
            {[geometry[2], geometry[1], depth[0], depth[2]].map((field) => (
              <StaticField key={field.label} field={field} compact />
            ))}
          </div>
          <Group title="Geometry">
            <FieldGrid
              fields={[geometry[0], geometry[3], geometry[4]]}
              compact
            />
          </Group>
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
        </EffectBlock>
        <EffectBlock title="Extrusion" count="ON">
          <FieldGrid fields={[depth[1], depth[3], depth[4]]} compact />
        </EffectBlock>
      </>
    ),
  },
  {
    title: "Secuencia de efectos",
    tag: "07 / ORDER",
    content: (
      <div className="tel-sequence">
        <div className="tel-step">
          <span>01</span>
          <EffectBlock title="Cylinder" count="ON">
            <div className="tel-state">
              Closed <span>360°</span>
            </div>
            <FieldGrid fields={closedGeometry} compact />
          </EffectBlock>
        </div>
        <ArrowDown size={16} />
        <div className="tel-step">
          <span>02</span>
          <EffectBlock title="Extrusion" count="ON">
            <FieldGrid fields={depth} compact />
          </EffectBlock>
        </div>
        <div className="tel-step">
          <span>03</span>
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
        </div>
      </div>
    ),
  },
  {
    title: "Preview + dock",
    tag: "08 / CANVAS",
    content: (
      <div className="tel-preview-layout">
        <div className="tel-preview">
          <span>3D TYPE</span>
          <small>CYLINDER · 360°</small>
        </div>
        <div className="tel-dock">
          <StaticSwitch label="Cylinder" />
          <div className="tel-state">
            Closed <span>360°</span>
          </div>
          <FieldGrid fields={closedGeometry} compact />
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
          <EffectBlock title="Extrusion" count="ON">
            <FieldGrid fields={depth} compact />
          </EffectBlock>
        </div>
      </div>
    ),
  },
  {
    title: "Tabla de valores",
    tag: "09 / DENSE",
    content: (
      <>
        <CylinderMode arc="150°" />
        <div className="tel-table">
          <div className="tel-table-heading">
            <b>CYLINDER</b>
            <b>VALUE</b>
            <b>ADJUST</b>
          </div>
          {geometry.map((field) => (
            <div className="tel-table-row" key={field.label}>
              <span>{field.label}</span>
              <b>
                {field.value} <small>{field.unit}</small>
              </b>
              <div className="tel-rail">
                <i style={{ width: `${field.position ?? 50}%` }} />
                <b style={{ left: `${field.position ?? 50}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="tel-table-lower">
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
          <EffectBlock title="Extrusion" count="ON">
            <FieldGrid fields={depth} compact />
          </EffectBlock>
        </div>
      </>
    ),
  },
  {
    title: "Esencial + avanzado",
    tag: "10 / FOCUS",
    content: (
      <>
        <EffectBlock title="Cylinder" count="ON">
          <div className="tel-state">
            Open arc <span>150°</span>
          </div>
          <div className="tel-essential">
            <div className="tel-preview tel-preview-small">
              <span>TYPE</span>
            </div>
            <div className="tel-quick-grid">
              {[geometry[2], geometry[1], geometry[4]].map((field) => (
                <StaticField key={field.label} field={field} compact />
              ))}
            </div>
          </div>
          <Group title="Geometry">
            <FieldGrid fields={[geometry[0], geometry[3]]} compact />
          </Group>
          <Group title="Back surface">
            <FieldGrid fields={surface} compact />
          </Group>
        </EffectBlock>
        <EffectBlock title="Extrusion" count="ON">
          <div className="tel-quick-grid">
            {[depth[0], depth[2]].map((field) => (
              <StaticField key={field.label} field={field} compact />
            ))}
          </div>
          <Group title="More controls">
            <FieldGrid fields={[depth[1], depth[3], depth[4]]} compact />
          </Group>
        </EffectBlock>
      </>
    ),
  },
];

export default function TextEffectsLabPage() {
  return (
    <main className="tel-page">
      <header className="tel-header">
        <span>SA / DESIGN LAB</span>
        <span>DEVELOPMENT ONLY</span>
        <h1>
          Text effects
          <br />
          10 panel layouts
        </h1>
        <nav aria-label="Proposals">
          {panels.map((panel, index) => (
            <a key={panel.tag} href={`#text-layout-${index + 1}`}>
              {String(index + 1).padStart(2, "0")}
            </a>
          ))}
        </nav>
      </header>
      <div className="tel-grid">
        {panels.map((panel, index) => (
          <article
            className={`tel-concept tel-concept-${index + 1}`}
            id={`text-layout-${index + 1}`}
            key={panel.title}
          >
            <header>
              <span>{panel.tag}</span>
              <h2>{panel.title}</h2>
            </header>
            <div className="tel-panel">{panel.content}</div>
          </article>
        ))}
      </div>
    </main>
  );
}
