import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Folder,
  Grid2X2,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { VINYL_DESIGNER_WIZARD_PRO_PATH } from "./identity-routes";
import "./design-gallery-concepts.css";

const projects = [
  {
    title: "Other frequencies",
    subtitle: "Vinyl sleeve · Side A / B",
    updated: "8 min ago",
    status: "Draft",
    image: "/media/images/releases/sajs001/cover.png",
    backImage:
      "/media/images/releases/sajs001/photos/Strange%20Animals%20VA%20Odyssey%20vol%20I%20Vinyl-preview.jpg",
  },
  {
    title: "Odyssey — inner label",
    subtitle: "12 inch · Side A",
    updated: "Yesterday",
    status: "Ready",
    image:
      "/media/images/releases/sajs001/photos/Strange%20Animals%20VA%20Odyssey%20vol%20I%20Vinyl-preview.jpg",
    backImage: "/media/images/releases/sajs001/cover.png",
  },
  {
    title: "Jazz Licks, vol. I",
    subtitle: "Vinyl sleeve · Side B",
    updated: "18 Oct 2026",
    status: "Draft",
    image: "/media/images/releases/sajs003/cover.png",
    backImage:
      "/media/images/releases/sajs001/photos/Strange%20Animals%20VA%20Odyssey%20vol%20I%20Vinyl.jpg",
  },
  {
    title: "Blue room / test 04",
    subtitle: "Label study · 7 inch",
    updated: "12 Oct 2026",
    status: "Shared",
    image: "/media/images/releases/sajs001/cover.png",
    backImage:
      "/media/images/releases/sajs001/photos/Strange%20Animals%20VA%20Odyssey%20vol%20I%20CD-preview.jpg",
  },
];

const concepts = [
  {
    id: "library",
    number: "01",
    name: "The library",
    note: "A calm, familiar grid for everyday use.",
  },
  {
    id: "wall",
    number: "02",
    name: "Sleeve wall",
    note: "Artwork first, with one project in focus.",
  },
  {
    id: "archive",
    number: "03",
    name: "The archive",
    note: "A compact index when the collection grows.",
  },
  {
    id: "shelf",
    number: "04",
    name: "Studio shelf",
    note: "A tactile, record-store inspired overview.",
  },
];

function Artwork({
  project,
  className = "",
}: {
  project: (typeof projects)[number];
  className?: string;
}) {
  return (
    <div className={`gc-artwork ${className}`}>
      <img src={project.image} alt="" />
      <span>SA / DESIGN STUDY</span>
    </div>
  );
}

function GalleryRecordArtwork({
  project,
}: {
  project: (typeof projects)[number];
}) {
  return (
    <div className="gc-artwork gc-record-artwork">
      <img className="gc-face-a" src={project.image} alt="" />
      <img className="gc-face-b" src={project.backImage} alt="" />
      <span className="gc-face-label-a">A / FRONT</span>
      <span className="gc-face-label-b">B / BACK</span>
    </div>
  );
}

function Status({ children }: { children: string }) {
  return (
    <span className={`gc-status gc-status-${children.toLowerCase()}`}>
      {children}
    </span>
  );
}

function LibraryPreview() {
  return (
    <div className="gc-preview gc-library">
      <div className="gc-mini-toolbar">
        <b>
          MY GALLERY <small>08</small>
        </b>
        <span>
          <Search size={12} /> Search
        </span>
        <span>
          <SlidersHorizontal size={12} /> Filter
        </span>
      </div>
      <div className="gc-tabs">
        <b>
          All designs <i>08</i>
        </b>
        <span>Drafts 05</span>
        <span>Ready 02</span>
        <span>Shared 01</span>
      </div>
      <div className="gc-library-grid">
        {projects.map((project) => (
          <article key={project.title}>
            <Artwork project={project} />
            <div className="gc-project-meta">
              <b>{project.title}</b>
              <MoreHorizontal size={14} />
            </div>
            <small>{project.updated}</small>
            <Status>{project.status}</Status>
          </article>
        ))}
      </div>
    </div>
  );
}

function WallPreview() {
  return (
    <div className="gc-preview gc-wall">
      <div className="gc-wall-feature">
        <Artwork project={projects[0]} />
        <div>
          <small>LAST OPENED · 8 MIN AGO</small>
          <h3>Other frequencies</h3>
          <p>Vinyl sleeve / Side A + B</p>
          <Status>Draft</Status>
          <span className="gc-continue">
            <Pencil size={12} /> Continue editing <ArrowRight size={13} />
          </span>
        </div>
      </div>
      <div className="gc-wall-rail">
        {projects.slice(1).map((project, index) => (
          <div key={project.title}>
            <Artwork project={project} />
            <span>0{index + 2}</span>
          </div>
        ))}
        <small>+ 4 OLDER</small>
      </div>
    </div>
  );
}

function ArchivePreview() {
  return (
    <div className="gc-preview gc-archive">
      <div className="gc-archive-heading">
        <b>DESIGN ARCHIVE</b>
        <span>08 projects · sorted by recent</span>
        <span>
          <SlidersHorizontal size={12} /> Sort
        </span>
      </div>
      <div className="gc-archive-columns">
        <span>PROJECT</span>
        <span>FORMAT</span>
        <span>STATUS</span>
        <span>MODIFIED</span>
      </div>
      {projects.map((project, index) => (
        <div className="gc-archive-row" key={project.title}>
          <Artwork project={project} />
          <div>
            <b>{project.title}</b>
            <small>SA-D{String(24 + index).padStart(3, "0")}</small>
          </div>
          <span>{index === 2 ? "7 inch" : "12 inch"}</span>
          <Status>{project.status}</Status>
          <small>{project.updated}</small>
          <ArrowUpRight size={13} />
        </div>
      ))}
    </div>
  );
}

function ShelfPreview() {
  return (
    <div className="gc-preview gc-shelf">
      <div className="gc-shelf-head">
        <span>YOUR STUDIO / 08 DESIGNS</span>
        <span>
          <Grid2X2 size={12} /> Shelf view
        </span>
      </div>
      <div className="gc-records">
        {projects.map((project, index) => (
          <article
            className={`gc-record gc-record-${index + 1}`}
            key={project.title}
          >
            <GalleryRecordArtwork project={project} />
            <b>{project.title}</b>
            <small>{project.subtitle}</small>
            <Status>{project.status}</Status>
          </article>
        ))}
      </div>
      <div className="gc-shelf-foot">
        <span>RECENTLY TOUCHED</span>
        <span>04 / 08</span>
      </div>
    </div>
  );
}

function Preview({ id }: { id: string }) {
  if (id === "wall") return <WallPreview />;
  if (id === "archive") return <ArchivePreview />;
  if (id === "shelf") return <ShelfPreview />;
  return <LibraryPreview />;
}

export default function DesignGalleryConceptsPage() {
  const [selected, setSelected] = useState("shelf");
  const selectedName = concepts.find(
    (concept) => concept.id === selected,
  )?.name;

  return (
    <main className="gc-page">
      <header className="gc-header">
        <a
          href={VINYL_DESIGNER_WIZARD_PRO_PATH}
          aria-label="Back to Vinyl Designer Wizard Pro"
        >
          <img src="/media/images/logos/sa-logo.png" alt="Strange Animals" />
        </a>
        <div>
          <span>IDENTITY</span>
          <i>/</i>
          <span>VINYL DESIGNER WIZARD PRO</span>
          <i>/</i>
          <b>GALLERY STUDY</b>
        </div>
        <a className="gc-back" href={VINYL_DESIGNER_WIZARD_PRO_PATH}>
          <ArrowLeft size={14} /> Back to Vinyl Designer Wizard Pro
        </a>
      </header>
      <div className="gc-main">
        <section className="gc-intro">
          <div>
            <p className="gc-kicker">
              <Sparkles size={14} /> PERSONAL DESIGN LIBRARY / FOUR DIRECTIONS
            </p>
            <h1>A home for every sleeve.</h1>
            <p>
              Save a draft, pick up where you left off, and keep finished
              designs close at hand.
            </p>
          </div>
          <div className="gc-study-mark">
            <span>VISUAL STUDY</span>
            <b>01 — 04</b>
          </div>
        </section>
        <section
          className="gc-concepts"
          aria-label="Four design gallery concepts"
        >
          {concepts.map((concept) => (
            <article
              className={`gc-concept gc-concept-${concept.id}${selected === concept.id ? " is-selected" : ""}`}
              key={concept.id}
            >
              <header>
                <div>
                  <span>{concept.number}</span>
                  <h2>{concept.name}</h2>
                </div>
                <p>{concept.note}</p>
              </header>
              <Preview id={concept.id} />
              <footer>
                <span>
                  {concept.id === "library"
                    ? "Best for quick scanning"
                    : concept.id === "wall"
                      ? "Best for visual browsing"
                      : concept.id === "archive"
                        ? "Best for large libraries"
                        : "Best for a personal studio"}
                </span>
                <button
                  type="button"
                  aria-pressed={selected === concept.id}
                  onClick={() => setSelected(concept.id)}
                >
                  {selected === concept.id ? (
                    <>
                      <Check size={13} /> Selected
                    </>
                  ) : (
                    "Select direction"
                  )}
                </button>
              </footer>
            </article>
          ))}
        </section>
        <section className="gc-recommendation">
          <div>
            <p className="gc-kicker">ENTRY POINT RECOMMENDATION</p>
            <h2>Put “My Gallery” beside Save.</h2>
            <p>
              It appears where someone finishes a session and stays easy to find
              when they return to the configurator.
            </p>
            <small>CURRENTLY SELECTED · {selectedName?.toUpperCase()}</small>
          </div>
          <div className="gc-toolbar-demo">
            <div>
              <span>OTHER FREQUENCIES</span>
              <span>VINYL LABEL / AUTORECOVERY ON</span>
            </div>
            <nav aria-label="Suggested gallery button location">
              <span>File</span>
              <span className="gc-demo-save">Save</span>
              <span className="gc-demo-gallery">
                <Folder size={12} /> My Gallery
              </span>
              <span>Project settings</span>
              <span className="gc-demo-export">Export</span>
            </nav>
            <small>
              <ArrowUpRight size={12} /> Add the gallery entry right next to the
              existing Save action.
            </small>
          </div>
        </section>
        <footer className="gc-page-footer">
          <span>Development-only concept page · not exposed in production</span>
          <span>
            Sample captures · front/back alternation is a visual study
          </span>
        </footer>
      </div>
    </main>
  );
}
