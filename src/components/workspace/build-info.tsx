"use client";

import { useMemo } from "react";
import { useYard } from "@/lib/yard/store";
import { buildInfo } from "@/lib/yard/buildInfo";

/** "How this was built": source, trust and the checks it passed. Local data only, no AI. */
export function BuildInfoPanel() {
  const project = useYard((s) => s.project);
  const info = useMemo(() => buildInfo(project), [project]);
  return (
    <details data-yard-build-info={info.trust} className="border-t border-border/60 px-3 py-2 text-xs">
      <summary className="cursor-pointer text-muted hover:text-fg">
        How this was built · <span className="text-fg">{info.source}</span> · <span className={info.trust === "Trusted" ? "text-fg" : "text-muted"}>{info.trust}</span>
      </summary>
      <ul className="mt-1 space-y-0.5 text-muted">
        {info.passed.map((c) => <li key={c}>✓ {c}</li>)}
        {info.failed.map((c) => <li key={c}>• Still to check: {c}</li>)}
      </ul>
    </details>
  );
}
