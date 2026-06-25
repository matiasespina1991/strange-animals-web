import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validateReleaseId } from "./release-id";

type VerificationResult = ReturnType<typeof validateReleaseId>;

export function ReleaseIdVerifierPage() {
  const [releaseId, setReleaseId] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChecking(true);
    setResult(null);

    window.setTimeout(() => {
      try {
        setResult(validateReleaseId(releaseId));
      } catch {
        setResult({
          valid: false,
          message: "There was an error while trying to verify this release ID.",
        });
      } finally {
        setChecking(false);
      }
    }, 180);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.08),transparent_28rem),#000] p-4 text-white md:p-8">
      <Card className="w-full max-w-[34rem] p-5 md:p-8">
        <a
          className="mb-8 inline-flex text-sm text-white/70 hover:text-white"
          href="/"
        >
          Back to homepage
        </a>
        <h1 className="text-[clamp(2rem,8vw,3.75rem)] font-bold leading-none">
          Release ID Verifier
        </h1>
        <p className="mt-4 leading-6 text-white/70">
          Verify whether a Strange Animals release ID is structurally valid.
        </p>

        <form className="mt-8 grid gap-3" onSubmit={handleSubmit}>
          <label
            className="text-xs uppercase tracking-[0.08em] text-white/80"
            htmlFor="release-id"
          >
            Release ID
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              autoComplete="off"
              id="release-id"
              inputMode="text"
              name="releaseId"
              placeholder="10088424001A17"
              required
              value={releaseId}
              onChange={(event) => {
                setReleaseId(event.target.value);
              }}
            />
            <Button disabled={checking} type="submit">
              {checking ? "Checking..." : "Verify"}
            </Button>
          </div>
        </form>

        {(checking || result) && (
          <div
            className={[
              "mt-4 rounded-xl border bg-white/5 p-4",
              result?.valid ? "border-emerald-300/50" : "",
              result?.valid ? "border-white/10" : "border-red-300/50",
            ].join(" ")}
            role="status"
          >
            <p className="m-0 font-bold">
              {checking ? "Checking release ID..." : result?.message}
            </p>
            {result?.valid && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Object.entries(result.display).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <span className="block text-xs text-white/55">{label}</span>
                    <span className="mt-1 block break-words font-mono">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </main>
  );
}
