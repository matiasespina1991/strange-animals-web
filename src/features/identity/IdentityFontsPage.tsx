import {useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteFontCatalogItem,
  downloadFontFamily,
  listFontCatalog,
  listFontVariants,
  loadFontVariant,
  updateFontParentCategory,
  type FontCatalogItem,
  type FontVariant,
} from './font-catalog-repository';

const SHOW_FONT_DELETE_CONTROLS = import.meta.env.DEV;
const FONT_PARENT_CATEGORIES = [
  'Abstract',
  'Outlined',
  'Pixel',
  'Standard',
  'Tridimensional',
] as const;
const VARIANTS_PER_PAGE = 3;
const MAX_BACKGROUND_IMAGE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_BACKGROUND_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type BackgroundImage = {
  name: string;
  url: string;
};

type TextAlignment = 'left' | 'center' | 'right';

function FontSpecimen({
  backgroundColor,
  backgroundImageUrl,
  font,
  fontColor,
  fontSize,
  letterSpacing,
  lineHeight,
  textAlignment,
  deleting,
  categoryUpdating,
  onDelete,
  onParentCategoryChange,
  specimen,
}: {
  backgroundColor: string;
  backgroundImageUrl?: string;
  font: FontCatalogItem;
  fontColor: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textAlignment: TextAlignment;
  deleting: boolean;
  categoryUpdating: boolean;
  onDelete: (font: FontCatalogItem) => void;
  onParentCategoryChange: (
    font: FontCatalogItem,
    parentCategory: string | null,
  ) => void;
  specimen: string;
}) {
  const cardReference = useRef<HTMLElement>(null);
  const [variants, setVariants] = useState<FontVariant[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [familyNames, setFamilyNames] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);

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
          setCurrentPage(0);
        })
        .catch(() => undefined);
    };

    if (!('IntersectionObserver' in window)) {
      load();
      return () => {
        active = false;
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
      observer.disconnect();
    };
  }, [font]);

  const variantTotal =
    variants.length > 0 ? variants.length : font.variantCount;
  const pageTotal = Math.ceil(variantTotal / VARIANTS_PER_PAGE);
  const pageStart = currentPage * VARIANTS_PER_PAGE;
  const visibleVariants = useMemo(
    () => variants.slice(pageStart, pageStart + VARIANTS_PER_PAGE),
    [pageStart, variants],
  );

  useEffect(() => {
    if (visibleVariants.length === 0) return;

    let active = true;

    void Promise.all(
      visibleVariants.map(async (variant) =>
        loadFontVariant(font, variant)
          .then((familyName) => {
            if (!active) return;
            setFamilyNames((current) => ({
              ...current,
              [variant.id]: familyName,
            }));
          })
          .catch(() => undefined),
      ),
    );

    return () => {
      active = false;
    };
  }, [font, visibleVariants]);

  const downloadFamily = () => {
    setDownloading(true);
    void downloadFontFamily(font)
      .catch(() => undefined)
      .finally(() => {
        setDownloading(false);
      });
  };

  return (
    <article
      ref={cardReference}
      className="flex min-h-60 flex-col border-t border-white/35 py-4 sm:min-h-[15rem] sm:py-5"
    >
      <div className="flex items-start justify-between gap-4 text-[0.625rem] leading-none tracking-[0.12em] text-white/55 uppercase">
        <div className="flex min-w-0 max-w-[45%] items-center gap-2">
          {SHOW_FONT_DELETE_CONTROLS ? (
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
          ) : null}
          <h2 className="min-w-0 truncate font-normal text-white/80">
            {font.name}
          </h2>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {SHOW_FONT_DELETE_CONTROLS ? (
            <select
              aria-label={`Parent category for ${font.name}`}
              className="h-6 w-28 cursor-pointer rounded-none border border-white/25 bg-black px-1 text-[0.5625rem] tracking-[0.08em] text-white/60 normal-case shadow-none outline-none focus:border-white/55 focus:outline-none disabled:cursor-wait disabled:opacity-40 sm:w-32"
              disabled={categoryUpdating}
              title={`Parent category for ${font.name}`}
              value={font.parentCategory ?? ''}
              onChange={(event) => {
                onParentCategoryChange(font, event.target.value || null);
              }}
            >
              <option value="">—</option>
              {font.parentCategory &&
              !FONT_PARENT_CATEGORIES.includes(
                font.parentCategory as (typeof FONT_PARENT_CATEGORIES)[number],
              ) ? (
                <option value={font.parentCategory}>
                  {font.parentCategory}
                </option>
              ) : null}
              {FONT_PARENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          ) : null}
          {pageTotal > 1 ? (
            <>
              <button
                aria-label={`Previous variant page of ${font.name}`}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center border border-white/35 bg-transparent text-white/60 shadow-none outline-none hover:border-white/60 hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-default disabled:border-white/15 disabled:text-white/20"
                disabled={currentPage === 0}
                type="button"
                onClick={() => {
                  setCurrentPage((page) => Math.max(page - 1, 0));
                }}
              >
                <ChevronLeft aria-hidden="true" className="size-3" />
              </button>
              <span aria-live="polite" className="w-10 text-center">
                {currentPage + 1}/{pageTotal}
              </span>
              <button
                aria-label={`Next variant page of ${font.name}`}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center border border-white/35 bg-transparent text-white/60 shadow-none outline-none hover:border-white/60 hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-default disabled:border-white/15 disabled:text-white/20"
                disabled={currentPage === pageTotal - 1}
                type="button"
                onClick={() => {
                  setCurrentPage((page) => Math.min(page + 1, pageTotal - 1));
                }}
              >
                <ChevronRight aria-hidden="true" className="size-3" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-8 mb-[1.4rem] space-y-6">
        {visibleVariants.map((variant) => {
          const familyName = familyNames[variant.id];
          const variantName = variant.fileName
            .replace(/\.[^/.]+$/, '')
            .replaceAll('-', ' ')
            .replace(/\s+/g, ' ')
            .trim();

          return (
            <div key={variant.id}>
              <p
                className={`px-4 py-8 leading-normal break-words whitespace-pre-wrap text-white ${familyName ? 'visible' : 'invisible'}`}
                style={{
                  backgroundColor,
                  backgroundImage: backgroundImageUrl
                    ? `url(${backgroundImageUrl})`
                    : undefined,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'cover',
                  color: fontColor,
                  fontFamily: familyName,
                  fontSize: `${fontSize}px`,
                  letterSpacing: `${letterSpacing}em`,
                  lineHeight,
                  textAlign: textAlignment,
                }}
              >
                {specimen || font.name}
              </p>
              {variantTotal > 1 ? (
                <div className="mt-2 flex min-w-0 justify-end text-[0.625rem] tracking-[0.08em] uppercase">
                  <span
                    className="min-w-0 overflow-hidden text-right text-white/70 text-ellipsis whitespace-nowrap"
                    title={variantName}
                  >
                    {variantName}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          aria-busy={downloading}
          className="flex h-6 shrink-0 cursor-pointer items-center gap-2 bg-white px-2 text-[0.625rem] tracking-[0.08em] text-black uppercase transition-colors duration-150 hover:bg-white/80 disabled:cursor-wait disabled:opacity-50"
          disabled={downloading || font.fileCount === 0}
          type="button"
          onClick={downloadFamily}
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
  const [lineHeight, setLineHeight] = useState(1.5);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [textAlignment, setTextAlignment] = useState<TextAlignment>('left');
  const [typographySettingsOpen, setTypographySettingsOpen] = useState(false);
  const [fontColor, setFontColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [backgroundMode, setBackgroundMode] = useState<'color' | 'image'>(
    'color',
  );
  const [backgroundImage, setBackgroundImage] = useState<BackgroundImage>();
  const [backgroundSettingsOpen, setBackgroundSettingsOpen] = useState(false);
  const [backgroundImageError, setBackgroundImageError] = useState<string>();
  const [fontPendingDeletion, setFontPendingDeletion] =
    useState<FontCatalogItem>();
  const [deletingFontIds, setDeletingFontIds] = useState<Set<string>>(
    new Set(),
  );
  const [updatingCategoryIds, setUpdatingCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [collapsedCategoryKeys, setCollapsedCategoryKeys] = useState<
    Set<string>
  >(new Set());
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const deferredSearch = useDeferredValue(search);
  const typographySettingsReference = useRef<HTMLDivElement>(null);
  const typographySettingsButtonReference = useRef<HTMLButtonElement>(null);
  const backgroundSettingsReference = useRef<HTMLDivElement>(null);
  const backgroundSettingsButtonReference = useRef<HTMLButtonElement>(null);
  const backgroundImageInputReference = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!typographySettingsOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !typographySettingsReference.current?.contains(event.target)
      ) {
        setTypographySettingsOpen(false);
      }
    };

    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setTypographySettingsOpen(false);
      typographySettingsButtonReference.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnKeyDown);

    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnKeyDown);
    };
  }, [typographySettingsOpen]);

  useEffect(() => {
    if (!backgroundSettingsOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !backgroundSettingsReference.current?.contains(event.target)
      ) {
        setBackgroundSettingsOpen(false);
      }
    };

    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setBackgroundSettingsOpen(false);
      backgroundSettingsButtonReference.current?.focus();
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnKeyDown);

    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnKeyDown);
    };
  }, [backgroundSettingsOpen]);

  useEffect(() => {
    const imageUrl = backgroundImage?.url;

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [backgroundImage?.url]);

  const visibleFonts = useMemo(() => {
    const term = deferredSearch.trim().toLocaleLowerCase();

    if (!term) return fonts;

    return fonts.filter((font) =>
      `${font.name} ${font.formats.join(' ')}`
        .toLocaleLowerCase()
        .includes(term),
    );
  }, [deferredSearch, fonts]);

  const fontSections = useMemo(() => {
    const categorizedFonts = new Map<string, FontCatalogItem[]>();
    const uncategorizedFonts: FontCatalogItem[] = [];

    for (const font of visibleFonts) {
      if (!font.parentCategory) {
        uncategorizedFonts.push(font);
        continue;
      }

      const categoryFonts = categorizedFonts.get(font.parentCategory) ?? [];
      categoryFonts.push(font);
      categorizedFonts.set(font.parentCategory, categoryFonts);
    }

    const sections = [...categorizedFonts.entries()]
      .sort(([leftCategory], [rightCategory]) =>
        leftCategory.localeCompare(rightCategory, undefined, {
          sensitivity: 'base',
        }),
      )
      .map(([name, sectionFonts]) => ({
        key: `category-${name}`,
        name,
        fonts: sectionFonts,
      }));

    if (uncategorizedFonts.length > 0) {
      sections.push({
        key: 'uncategorized',
        name: 'Uncategorized',
        fonts: uncategorizedFonts,
      });
    }

    return sections;
  }, [visibleFonts]);

  const changeParentCategory = async (
    font: FontCatalogItem,
    parentCategory: string | null,
  ) => {
    const previousCategory = font.parentCategory;

    setErrorMessage(undefined);
    setUpdatingCategoryIds((current) => new Set(current).add(font.id));
    setFonts((current) =>
      current.map((item) =>
        item.id === font.id ? {...item, parentCategory} : item,
      ),
    );

    try {
      await updateFontParentCategory(font, parentCategory);
    } catch {
      setFonts((current) =>
        current.map((item) =>
          item.id === font.id
            ? {...item, parentCategory: previousCategory}
            : item,
        ),
      );
      setErrorMessage(`Could not update “${font.name}”. Try again.`);
    } finally {
      setUpdatingCategoryIds((current) => {
        const next = new Set(current);
        next.delete(font.id);
        return next;
      });
    }
  };

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

  const selectBackgroundImage = (file?: File) => {
    if (!file) return;

    if (!ACCEPTED_BACKGROUND_IMAGE_TYPES.has(file.type)) {
      setBackgroundImageError('Choose a JPG, PNG or WEBP image.');
      return;
    }

    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) {
      setBackgroundImageError('Image must be 15 MB or smaller.');
      return;
    }

    setBackgroundImageError(undefined);
    setBackgroundImage({
      name: file.name,
      url: URL.createObjectURL(file),
    });
    setBackgroundMode('image');
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
              className="text-[0.8rem] font-normal tracking-[0.02em] text-white/70 lowercase"
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
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto_auto_12.5rem]">
            <label className="block">
              <span className="mb-2 block text-[0.625rem] tracking-[0.12em] text-white/50 uppercase">
                Demo text
              </span>
              <textarea
                className="block min-h-10 w-full resize-none overflow-hidden rounded-none border border-white/35 bg-black px-3 py-[0.7rem] text-xs leading-normal text-white outline-none placeholder:text-white/35"
                maxLength={800}
                rows={1}
                value={specimen}
                onChange={(event) => {
                  setSpecimen(event.target.value);
                  event.currentTarget.style.height = 'auto';
                  event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                }}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[0.625rem] tracking-[0.12em] text-white/50 uppercase">
                Search fonts
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

            <div
              ref={backgroundSettingsReference}
              className="relative self-start"
            >
              <span className="mb-2 block whitespace-nowrap text-[0.625rem] tracking-[0.12em] text-white/50 uppercase">
                Background
              </span>
              <span className="flex h-10 items-center">
                <button
                  ref={backgroundSettingsButtonReference}
                  aria-controls="background-settings"
                  aria-expanded={backgroundSettingsOpen}
                  aria-label="Background settings"
                  className="size-6 cursor-pointer border border-white/35 bg-transparent bg-cover bg-center outline-none focus:outline-none focus-visible:outline-none"
                  style={{
                    backgroundColor:
                      backgroundMode === 'color' ? backgroundColor : '#000000',
                    backgroundImage:
                      backgroundMode === 'image' && backgroundImage
                        ? `url(${backgroundImage.url})`
                        : undefined,
                  }}
                  type="button"
                  onClick={() => {
                    setBackgroundSettingsOpen((open) => !open);
                    setTypographySettingsOpen(false);
                  }}
                />
              </span>

              {backgroundSettingsOpen ? (
                <div
                  className="absolute top-full left-0 z-50 mt-2 w-72 max-w-[calc(100vw-2.5rem)] border border-white/45 bg-black p-4"
                  id="background-settings"
                >
                  <div
                    aria-label="Background type"
                    className="grid grid-cols-2 border border-white/35"
                    role="group"
                  >
                    <button
                      aria-pressed={backgroundMode === 'color'}
                      className={`h-8 cursor-pointer text-[0.625rem] tracking-[0.1em] uppercase ${backgroundMode === 'color' ? 'bg-white text-black' : 'bg-black text-white/60 hover:text-white'}`}
                      type="button"
                      onClick={() => {
                        setBackgroundMode('color');
                      }}
                    >
                      Color
                    </button>
                    <button
                      aria-pressed={backgroundMode === 'image'}
                      className={`h-8 cursor-pointer border-l border-white/35 text-[0.625rem] tracking-[0.1em] uppercase ${backgroundMode === 'image' ? 'bg-white text-black' : 'bg-black text-white/60 hover:text-white'}`}
                      type="button"
                      onClick={() => {
                        setBackgroundMode('image');
                      }}
                    >
                      Image
                    </button>
                  </div>

                  {backgroundMode === 'color' ? (
                    <label className="mt-5 flex items-center justify-between gap-4">
                      <span className="text-[0.625rem] tracking-[0.08em] text-white/60 uppercase">
                        Fill color
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-[0.625rem] text-white/55 uppercase">
                          {backgroundColor}
                        </span>
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
                  ) : (
                    <div className="mt-5">
                      <input
                        ref={backgroundImageInputReference}
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        className="sr-only"
                        type="file"
                        onChange={(event) => {
                          selectBackgroundImage(event.target.files?.[0]);
                          event.currentTarget.value = '';
                        }}
                      />

                      {backgroundImage ? (
                        <>
                          <div
                            aria-label={`Selected background image: ${backgroundImage.name}`}
                            className="h-24 border border-white/35 bg-cover bg-center"
                            role="img"
                            style={{
                              backgroundImage: `url(${backgroundImage.url})`,
                            }}
                          />
                          <p
                            className="mt-2 overflow-hidden text-[0.625rem] text-white/60 text-ellipsis whitespace-nowrap"
                            title={backgroundImage.name}
                          >
                            {backgroundImage.name}
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              className="flex h-8 cursor-pointer items-center justify-center gap-2 border border-white/35 text-[0.625rem] text-white/65 uppercase hover:border-white/60 hover:text-white"
                              type="button"
                              onClick={() => {
                                backgroundImageInputReference.current?.click();
                              }}
                            >
                              <Upload aria-hidden="true" className="size-3" />
                              Replace
                            </button>
                            <button
                              className="flex h-8 cursor-pointer items-center justify-center gap-2 border border-white/35 text-[0.625rem] text-white/65 uppercase hover:border-white/60 hover:text-white"
                              type="button"
                              onClick={() => {
                                setBackgroundImage(undefined);
                                setBackgroundImageError(undefined);
                                setBackgroundMode('color');
                              }}
                            >
                              <X aria-hidden="true" className="size-3" />
                              Remove
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-3 border border-white/35 px-4 text-center text-white/60 hover:border-white/60 hover:text-white"
                          type="button"
                          onClick={() => {
                            backgroundImageInputReference.current?.click();
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            selectBackgroundImage(event.dataTransfer.files[0]);
                          }}
                        >
                          <ImageIcon aria-hidden="true" className="size-5" />
                          <span className="text-[0.625rem] tracking-[0.08em] uppercase">
                            Choose or drop image
                          </span>
                          <span className="text-[0.5625rem] text-white/40 uppercase">
                            JPG, PNG or WEBP · max 15 MB
                          </span>
                        </button>
                      )}

                      {backgroundImageError ? (
                        <p
                          className="mt-3 text-[0.625rem] text-white/65"
                          role="alert"
                        >
                          {backgroundImageError}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div
              ref={typographySettingsReference}
              className="relative flex items-start self-start gap-2 justify-self-start pt-[1.125rem]"
            >
              <label className="flex h-10 w-40 items-center gap-3 text-white/70">
                <span aria-hidden="true" className="text-sm">
                  A
                </span>
                <span className="sr-only">Text size</span>
                <input
                  aria-label="Text size"
                  className="identity-font-size-slider w-full"
                  max="140"
                  min="8"
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
              </label>

              <button
                ref={typographySettingsButtonReference}
                aria-controls="typography-settings"
                aria-expanded={typographySettingsOpen}
                aria-label="Typography settings"
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center bg-transparent text-white/65 shadow-none outline-none hover:text-white focus:outline-none focus-visible:outline-none"
                type="button"
                onClick={() => {
                  setTypographySettingsOpen((open) => !open);
                }}
              >
                <Settings aria-hidden="true" className="size-4" />
              </button>

              {typographySettingsOpen ? (
                <div
                  className="absolute top-full right-0 z-50 mt-2 w-64 border border-white/45 bg-black p-4"
                  id="typography-settings"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <span className="text-[0.625rem] tracking-[0.12em] text-white/55 uppercase">
                      Typography
                    </span>
                    <button
                      className="cursor-pointer text-[0.625rem] tracking-[0.08em] text-white/55 uppercase hover:text-white"
                      type="button"
                      onClick={() => {
                        setLineHeight(1.5);
                        setLetterSpacing(0);
                        setTextAlignment('left');
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mb-6">
                    <span className="mb-3 block text-[0.625rem] tracking-[0.08em] text-white/65 uppercase">
                      Alignment
                    </span>
                    <div
                      aria-label="Text alignment"
                      className="grid w-fit grid-cols-3 border border-white/35"
                      role="group"
                    >
                      <button
                        aria-label="Align text left"
                        aria-pressed={textAlignment === 'left'}
                        className={`flex size-8 cursor-pointer items-center justify-center border-r border-white/35 outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${textAlignment === 'left' ? 'bg-white text-black hover:text-black' : 'bg-black text-white/55'}`}
                        title="Align left"
                        type="button"
                        onClick={() => {
                          setTextAlignment('left');
                        }}
                      >
                        <AlignLeft aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label="Align text center"
                        aria-pressed={textAlignment === 'center'}
                        className={`flex size-8 cursor-pointer items-center justify-center border-r border-white/35 outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${textAlignment === 'center' ? 'bg-white text-black hover:text-black' : 'bg-black text-white/55'}`}
                        title="Align center"
                        type="button"
                        onClick={() => {
                          setTextAlignment('center');
                        }}
                      >
                        <AlignCenter aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label="Align text right"
                        aria-pressed={textAlignment === 'right'}
                        className={`flex size-8 cursor-pointer items-center justify-center outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${textAlignment === 'right' ? 'bg-white text-black hover:text-black' : 'bg-black text-white/55'}`}
                        title="Align right"
                        type="button"
                        onClick={() => {
                          setTextAlignment('right');
                        }}
                      >
                        <AlignRight aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-3 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65 uppercase">
                      <span>Line height</span>
                      <span>{lineHeight.toFixed(2)}</span>
                    </span>
                    <input
                      className="identity-font-size-slider block w-full"
                      max="2.5"
                      min="0.8"
                      step="0.05"
                      type="range"
                      value={lineHeight}
                      onChange={(event) => {
                        setLineHeight(Number(event.target.value));
                      }}
                    />
                  </label>

                  <label className="mt-6 block">
                    <span className="mb-3 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65 uppercase">
                      <span>Letter spacing</span>
                      <span>{letterSpacing.toFixed(2)} em</span>
                    </span>
                    <input
                      className="identity-font-size-slider block w-full"
                      max="0.5"
                      min="-0.1"
                      step="0.01"
                      type="range"
                      value={letterSpacing}
                      onChange={(event) => {
                        setLetterSpacing(Number(event.target.value));
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
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
          <section aria-label="Font catalog">
            {fontSections.map((section) => {
              const collapsed = collapsedCategoryKeys.has(section.key);
              const contentId = `font-section-${section.key
                .toLocaleLowerCase()
                .replace(/[^a-z\d]+/g, '-')}`;

              return (
                <section
                  key={section.key}
                  aria-label={`${section.name} fonts`}
                  className="pt-8 first:pt-6"
                >
                  <header className="mb-2 flex items-center gap-4">
                    <button
                      aria-controls={contentId}
                      aria-expanded={!collapsed}
                      className="flex shrink-0 cursor-pointer items-center gap-2 text-[0.625rem] font-normal tracking-[0.12em] text-white uppercase outline-none hover:text-white/75 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white/65"
                      type="button"
                      onClick={() => {
                        setCollapsedCategoryKeys((current) => {
                          const next = new Set(current);

                          if (next.has(section.key)) {
                            next.delete(section.key);
                          } else {
                            next.add(section.key);
                          }

                          return next;
                        });
                      }}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={`size-3 ${collapsed ? '' : 'rotate-90'}`}
                      />
                      <span>category: {section.name}</span>
                    </button>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-white/35"
                    />
                  </header>
                  <div
                    className={`${collapsed ? 'hidden' : 'grid'} gap-x-8 lg:grid-cols-2`}
                    id={contentId}
                  >
                    {section.fonts.map((font) => (
                      <FontSpecimen
                        key={font.id}
                        backgroundColor={backgroundColor}
                        backgroundImageUrl={
                          backgroundMode === 'image'
                            ? backgroundImage?.url
                            : undefined
                        }
                        categoryUpdating={updatingCategoryIds.has(font.id)}
                        deleting={deletingFontIds.has(font.id)}
                        font={font}
                        fontColor={fontColor}
                        fontSize={fontSize}
                        letterSpacing={letterSpacing}
                        lineHeight={lineHeight}
                        textAlignment={textAlignment}
                        onDelete={setFontPendingDeletion}
                        onParentCategoryChange={(nextFont, parentCategory) => {
                          void changeParentCategory(nextFont, parentCategory);
                        }}
                        specimen={specimen}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </section>
        )}
      </div>

      {SHOW_FONT_DELETE_CONTROLS && fontPendingDeletion ? (
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
