import { useEffect, useMemo, useState } from "react";
import {
  listWebampSkinsForStaffPicks,
  setWebampSkinStaffPick,
  type WebampSkinStaffPickRow,
} from "./webamp-skin-repository";

type SaveState = {
  message: string;
  tone: "error" | "info" | "success";
} | null;

function StaffPickCheckbox({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={[
        "group inline-flex items-center gap-2 text-left text-[0.72rem] leading-none tracking-[0.03em] text-white/84",
        disabled ? "opacity-50" : "hover:text-white",
      ].join(" ")}
      disabled={disabled}
      onClick={onToggle}
    >
      <span
        aria-hidden="true"
        className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center border border-[#d1d1d1cc] bg-black"
      >
        {checked ? (
          <span className="h-[2px] w-[8px] rotate-[-45deg] border-b-2 border-l-2 border-white" />
        ) : null}
      </span>
    </button>
  );
}

export function WinampSkinsStuffPicksPage() {
  const [rows, setRows] = useState<WebampSkinStaffPickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    listWebampSkinsForStaffPicks()
      .then((nextRows) => {
        if (active) {
          setRows(nextRows);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSaveState({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not load webamp skins.",
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const staffPicksCount = useMemo(
    () => rows.filter((row) => row.isStaffPick).length,
    [rows],
  );

  const handleToggle = async (row: WebampSkinStaffPickRow) => {
    const nextValue = !row.isStaffPick;
    setSavingId(row.id);
    setSaveState(null);
    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.id === row.id
          ? {
              ...currentRow,
              hasStaffPickProperty: true,
              isStaffPick: nextValue,
            }
          : currentRow,
      ),
    );

    try {
      console.log("[staff-picks] toggling row", {
        skinId: row.id,
        displayName: row.displayName,
        nextValue,
      });
      await setWebampSkinStaffPick(row.id, nextValue);
      setSaveState({
        tone: "success",
        message: `${row.displayName}: ${nextValue ? "staff pick enabled" : "staff pick disabled"}`,
      });
    } catch (error) {
      console.error("[staff-picks] toggle failed", {
        skinId: row.id,
        error,
      });
      setRows((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow.id === row.id
            ? {
                ...currentRow,
                hasStaffPickProperty: row.hasStaffPickProperty,
                isStaffPick: row.isStaffPick,
              }
            : currentRow,
        ),
      );
      setSaveState({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not update staff pick value.",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-black px-5 py-8 font-mono text-white md:px-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl uppercase tracking-[0.06em]">
              winamp-skins-stuff-picks
            </h1>
            <p className="mt-2 text-xs text-white/72">
              Manage which skins appear as staff picks in the Winamp dialog.
            </p>
          </div>
          <a className="text-xs underline underline-offset-4" href="/">
            home
          </a>
        </header>

        <div className="border border-[#d1d1d1cc] bg-black px-3 py-2 text-xs text-white/78">
          total: {rows.length} | staff picks: {staffPicksCount}
        </div>

        <div className="overflow-auto border border-[#d1d1d1cc]">
          <table className="w-full min-w-[44rem] border-collapse text-left text-[0.74rem] leading-tight">
            <thead>
              <tr className="border-b border-[#d1d1d1cc] bg-black text-white/86">
                <th className="px-3 py-2 font-normal uppercase tracking-[0.08em]">
                  skin
                </th>
                <th className="px-3 py-2 font-normal uppercase tracking-[0.08em]">
                  enabled
                </th>
                <th className="px-3 py-2 font-normal uppercase tracking-[0.08em]">
                  staff pick
                </th>
                <th className="px-3 py-2 font-normal uppercase tracking-[0.08em]">
                  id
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-3 text-white/70" colSpan={4}>
                    loading skins...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-white/70" colSpan={4}>
                    no skins found
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#d1d1d1cc]/70 text-white/84 last:border-b-0"
                  >
                    <td className="px-3 py-2">{row.displayName}</td>
                    <td className="px-3 py-2">
                      {row.enabled ? "true" : "false"}
                    </td>
                    <td className="px-3 py-2">
                      <StaffPickCheckbox
                        checked={row.isStaffPick}
                        label={`Staff pick for ${row.displayName}`}
                        disabled={savingId === row.id}
                        onToggle={() => {
                          void handleToggle(row);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-white/65">{row.id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
