import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {ChevronLeft, ChevronRight, Download, Trash2} from 'lucide-react';
import {
  deleteFontCatalogItem,
  downloadFontVariant,
  listFontCatalog,
  listFontVariants,
  loadFontVariant,
  type FontCatalogItem,
  type FontVariant,
} from './font-catalog-repository';

function FontSpecimen({
  backgroundColor,
  font,
  fontColor,
  fontSize,
  deleting,
  onDelete,
  specimen,
}: {
  backgroundColor: string;
  font: FontCatalogItem;
  fontColor: string;
  fontSize: number;
  deleting: boolean;
  onDelete: (font: FontCatalogItem) => void;
  specimen: string;
}) {
  const cardReference = useRef<HTMLElement>(null);
  const variantRequestId = useRef(0);
  const [familyName, setFamilyName] = useState<string>();
  const [variants, setVariants] = useState<FontVariant[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [variantLoading, setVariantLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadVariant = useCallback(
    (variant: FontVariant, index: number) => {
      const requestId = ++variantRequestId.current;

      setSelectedVariantIndex(index);
      setFamilyName(undefined);
      setVariantLoading(true);

      void loadFontVariant(font, variant)
        .then((nextFamilyName) => {
          if (variantRequestId.current === requestId) {
            setFamilyName(nextFamilyName);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (variantRequestId.current === requestId) {
            setVariantLoading(false);
          }
        });
    },
    [font],
  );

  useEffect(() => {
    const card = cardReference.current;

    if (!card || !font.preview) return;

    let active = true;
    let started = false;

    const load = () => {
      if (started) return;
      started = true;

      listFontVariants(font)
        .then((nextVariants) => {
          if (!active) return;

          setVariants(nextVariants);

          if (nextVariants[0]) {
            loadVariant(nextVariants[0], 0);
          } else {
            setVariantLoading(false);
          }
        })
        .catch(() => {
          if (active) setVariantLoading(false);
        });
    };

    if (!('IntersectionObserver' in window)) {
      load();
      return () => {
        active = false;
        variantRequestId.current += 1;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          load();
          observer.disconnect();
        }
      },
      {rootMargin: '240px'},
    );

    observer.observe(card);

    return () => {
      active = false;
      variantRequestId.current += 1;
      observer.disconnect();
    };
  }, [font, loadVariant]);

  const variantTotal =
    variants.length > 0 ? variants.length : font.variantCount;
  const selectedVariant = variants[selectedVariantIndex];
  const variantPosition = variantTotal === 0 ? 0 : selectedVariantIndex + 1;
  const variantCountLabel =
    variantTotal > 1 ? `${variantPosition}/${variantTotal}` : null;

  const selectVariant = (nextIndex: number) => {
    const nextVariant = variants[nextIndex];

    if (!nextVariant || variantLoading) return;
    loadVariant(nextVariant, nextIndex);
  };

  return (
    <article
      ref={cardReference}
      className="flex min-h-60 flex-col justify-between border-t border-white/35 py-4 sm:min-h-72 sm:py-5"
    >
      <div className="flex items-start justify-between gap-4 text-[0.625rem] leading-none tracking-[0.12em] text-white/55 uppercase">
        <div className="flex max-w-[45%] items-start gap-2">
          <button
            aria-label={`Delete ${font.name}`}
            className="shrink-0 text-white/40 hover:text-white disabled:cursor-wait disabled:text-white/20"
            disabled={deleting}
            title={`Delete ${font.name}`}
            type="button"
            onClick={() => {
              onDelete(font);
            }}
          >
            <Trash2 aria-hidden="true" className="size-[0.7rem]" />
          </button>
          <h2 className="font-normal text-white/80">{font.name}</h2>
        </div>
        <div className="flex min-w-0 max-w-[55%] items-center justify-end gap-2">
          {variantTotal > 1 && selectedVariant ? (
            <>
              <button
                aria-label={`Previous variant of ${font.name}`}
                className="cursor-pointer text-white/60 hover:text-white disabled:cursor-default disabled:text-white/20"
                disabled={selectedVariantIndex === 0 || variantLoading}
                type="button"
                onClick={() => {
                  selectVariant(selectedVariantIndex - 1);
                }}
              >
                <ChevronLeft aria-hidden="true" className="size-3" />
              </button>
              <span
                className="max-w-44 truncate text-white/70"
                title={selectedVariant.fileName}
              >
                {selectedVariant.fileName}
              </span>
              <button
                aria-label={`Next variant of ${font.name}`}
                className="cursor-pointer text-white/60 hover:text-white disabled:cursor-default disabled:text-white/20"
                disabled={
                  selectedVariantIndex === variantTotal - 1 || variantLoading
                }
                type="button"
                onClick={() => {
                  selectVariant(selectedVariantIndex + 1);
                }}
              >
                <ChevronRight aria-hidden="true" className="size-3" />
              </button>
            </>
          ) : null}
          {variantCountLabel ? (
            <span className="shrink-0">{variantCountLabel}</span>
          ) : null}
        </div>
      </div>

      <p
        className={`my-8 px-4 py-8 leading-[1.1] break-words text-white ${familyName ? 'visible' : 'invisible'}`}
        style={{
          backgroundColor,
          color: fontColor,
          fontFamily: familyName,
          fontSize: `${fontSize}px`,
        }}
      >
        {specimen || font.name}
      </p>

      <div className="flex justify-end">
        <button
          aria-busy={downloading}
          className="flex h-6 cursor-pointer items-center gap-2 bg-white px-2 text-[0.625rem] tracking-[0.08em] text-black uppercase transition-colors duration-150 hover:bg-white/80 disabled:cursor-wait disabled:opacity-50"
          disabled={!selectedVariant || downloading || variantLoading}
          type="button"
          onClick={() => {
            if (!selectedVariant) return;

            setDownloading(true);
            void downloadFontVariant(selectedVariant)
              .catch(() => undefined)
              .finally(() => {
                setDownloading(false);
              });
          }}
        >
          <Download aria-hidden="true" className="size-3" />
          Download
        </button>
      </div>
    </article>
  );
}

export function IdentityFontsPage() {
  const [fonts, setFonts] = useState<FontCatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [specimen, setSpecimen] = useState('');
  const [fontSize, setFontSize] = useState(34);
  const [fontColor, setFontColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [fontPendingDeletion, setFontPendingDeletion] =
    useState<FontCatalogItem>();
  const [deletingFontIds, setDeletingFontIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let active = true;

    listFontCatalog()
      .then((catalog) => {
        if (active) setFonts(catalog);
      })
      .catch(() => {
        if (active) setErrorMessage('Could not load the private font catalog.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleFonts = useMemo(() => {
    const term = deferredSearch.trim().toLocaleLowerCase();

    if (!term) return fonts;

    return fonts.filter((font) =>
      `${font.name} ${font.formats.join(' ')}`
        .toLocaleLowerCase()
        .includes(term),
    );
  }, [deferredSearch, fonts]);

  const deleteFont = async (font: FontCatalogItem) => {
    setFontPendingDeletion(undefined);
    setErrorMessage(undefined);
    setDeletingFontIds((current) => new Set(current).add(font.id));

    try {
      await deleteFontCatalogItem(font);
      setFonts((current) => current.filter((item) => item.id !== font.id));
    } catch {
      setErrorMessage(`Could not delete “${font.name}”. Try again.`);
    } finally {
      setDeletingFontIds((current) => {
        const next = new Set(current);
        next.delete(font.id);
        return next;
      });
    }
  };

  return (
    <main
      className="min-h-[100dvh] bg-black px-5 py-5 text-white sm:px-8 sm:py-7 lg:px-10"
      style={{fontFamily: "'Departure Mono', 'Courier New', monospace"}}
    >
      <div className="mx-auto max-w-[92rem]">
        <header className="border-b border-white/65 pb-5 sm:pb-6">
          <div className="flex items-baseline justify-between gap-6">
            <nav
              aria-label="Breadcrumb"
              className="text-[0.8rem] font-normal tracking-[0.02em] lowercase"
            >
              <span>strange animals</span>
              <span aria-hidden="true" className="mx-2 text-white/45">
                &gt;
              </span>
              <span>identity</span>
              <span aria-hidden="true" className="mx-2 text-white/45">
                &gt;
              </span>
              <h1 className="inline font-normal">fonts</h1>
            </nav>
            <p className="text-[0.625rem] tracking-[0.12em] text-white/55 uppercase">
              {loading
                ? 'loading'
                : `${visibleFonts.length.toString().padStart(2, '0')} / ${fonts.length
                    .toString()
                    .padStart(2, '0')}`}
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto_auto_10rem]">
            <label className="block">
              <span className="mb-2 block text-[0.625rem] tracking-[0.12em] text-white/50 uppercase">
                Demo text
              </span>
              <input
                className="h-10 w-full rounded-none border border-white/35 bg-black px-3 text-xs text-white outline-none placeholder:text-white/35"
                maxLength={80}
                type="text"
                value={specimen}
                onChange={(event) => {
                  setSpecimen(event.target.value);
                }}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[0.625rem] tracking-[0.12em] text-white/50 uppercase">
                Filter font by name
              </span>
              <input
                className="h-10 w-full rounded-none border border-white/35 bg-black px-3 text-xs text-white outline-none placeholder:text-white/35"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </label>

            <label className="block">
              <span className="mb-2 block whitespace-nowrap text-[0.625rem] tracking-[0.12em] text-white/50 uppercase">
                Font color
              </span>
              <span className="flex h-10 items-center">
                <input
                  className="identity-color-picker"
                  type="color"
                  value={fontColor}
                  onChange={(event) => {
                    setFontColor(event.target.value);
                  }}
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block whitespace-nowrap text-[0.625rem] tracking-[0.12em] text-white/50 uppercase">
                Background color
              </span>
              <span className="flex h-10 items-center">
                <input
                  className="identity-color-picker"
                  type="color"
                  value={backgroundColor}
                  onChange={(event) => {
                    setBackgroundColor(event.target.value);
                  }}
                />
              </span>
            </label>

            <label className="flex h-full items-end justify-self-start">
              <span className="sr-only">Text size</span>
              <span className="flex h-10 w-40 items-center gap-3 text-white/70">
                <span aria-hidden="true" className="text-sm">
                  A
                </span>
                <input
                  aria-label="Text size"
                  className="identity-font-size-slider w-full"
                  max="140"
                  min="24"
                  step="1"
                  type="range"
                  value={fontSize}
                  onChange={(event) => {
                    setFontSize(Number(event.target.value));
                  }}
                />
                <span aria-hidden="true" className="text-2xl leading-none">
                  A
                </span>
              </span>
            </label>
          </div>
        </header>

        {errorMessage ? (
          <p className="border-b border-white/25 py-6 text-xs text-white/65">
            {errorMessage}
          </p>
        ) : loading ? (
          <p className="py-6 text-xs text-white/50">loading catalog...</p>
        ) : visibleFonts.length === 0 ? (
          <p className="py-6 text-xs text-white/50">
            {fonts.length === 0
              ? 'The catalog is empty.'
              : 'No matching fonts. Try a shorter name or format.'}
          </p>
        ) : (
          <section
            aria-label="Font catalog"
            className="grid gap-x-8 lg:grid-cols-2"
          >
            {visibleFonts.map((font) => (
              <FontSpecimen
                key={font.id}
                backgroundColor={backgroundColor}
                deleting={deletingFontIds.has(font.id)}
                font={font}
                fontColor={fontColor}
                fontSize={fontSize}
                onDelete={setFontPendingDeletion}
                specimen={specimen}
              />
            ))}
          </section>
        )}
      </div>

      {fontPendingDeletion ? (
        <div
          aria-labelledby="delete-font-title"
          aria-modal="true"
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 px-5"
          role="dialog"
        >
          <div className="w-full max-w-md border border-white/55 bg-black p-5">
            <h2
              className="text-xs font-normal text-white"
              id="delete-font-title"
            >
              Delete “{fontPendingDeletion.name}”?
            </h2>
            <p className="mt-3 text-[0.625rem] leading-relaxed text-white/50 uppercase">
              This permanently removes its Firestore documents and Storage
              files.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="h-9 border border-white/35 px-4 text-[0.625rem] text-white/65 uppercase"
                type="button"
                onClick={() => {
                  setFontPendingDeletion(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="h-9 border border-white bg-white px-4 text-[0.625rem] text-black uppercase"
                type="button"
                onClick={() => {
                  void deleteFont(fontPendingDeletion);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
