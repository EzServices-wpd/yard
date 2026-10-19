"use client";

import { useMemo, useState } from "react";
import { useYard } from "@/lib/yard/store";
import { buildInfo } from "@/lib/yard/buildInfo";
import { permalink } from "@/lib/yard/shareBuild";

/** "How this was built": source, trust and the checks it passed. Local data only, no AI. */
export function BuildInfoPanel() {
  const project = useYard((s) => s.project);
  const info = useMemo(() => buildInfo(project), [project]);
  const link = useMemo(() => (project.displayOnly ? null : permalink(project, typeof window !== "undefined" ? window.location.origin : undefined)), [project]);
  const [copied, setCopied] = useState("");
  return (
    <>
    {link && (
      <p data-yard-permalink="1" className="flex items-center gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted">
        <span className="min-w-0 flex-1">{copied === link ? "Link copied. It rebuilds this exact model, stock and size." : "A link that rebuilds this exact build."}</span>
        <button type="button" className="inline-flex h-11 shrink-0 items-center rounded-full border border-border px-4 text-fg hover:bg-elevated" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(link); }}>
          Copy link
        </button>
      </p>
    )}
    <details data-yard-build-info={info.trust} className="border-t border-border/60 px-3 py-2 text-xs">
      <summary className="flex min-h-11 cursor-pointer items-center text-muted hover:text-fg">
        How this was built · <span className="text-fg">{info.source}</span>{info.trust === "Trusted" && <> · <span className="text-fg">Checked</span></>}
      </summary>
      <ul className="mt-1 space-y-0.5 text-muted">
        {info.passed.map((c) => <li key={c}>✓ {c}</li>)}
        {info.failed.map((c) => <li key={c}>• Still to check: {c}</li>)}
      </ul>
    </details>
    </>
  );
}
