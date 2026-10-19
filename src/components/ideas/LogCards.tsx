import type { SnapshotRow } from "@/lib/yard/ideaLog";
import { dimsOf } from "@/lib/ideas/liveFeed";
import { formatSize } from "@/lib/ideas/size";

/** A logged build with its honest flag (R8): Trusted or Unverified. Failed rows never reach here. */
export function LogCard({ row, onOpen }: { row: SnapshotRow; onOpen: () => void }) {
  const size = formatSize(dimsOf(row.size ?? "")); // the engine's logged W×D×H
  return (
    <button type="button" onClick={onOpen} data-yard-log-row={row.status} className="yard-paper group flex flex-col rounded-xl border border-rule bg-paper p-4 text-left hover:border-ink/35">
      <span className={`self-start rounded-full border px-2 py-0.5 text-[13px] font-medium ${row.status === "Trusted" ? "border-ink/30 text-ink" : "border-amber-700/40 text-amber-800"}`}>{row.status}</span>
      <span className="mt-2 font-display text-lg text-ink group-hover:underline">{row.prompt}</span>
      <span className="mt-1 text-sm text-ink">
        {size.text ? <><span className="yard-measure" data-size aria-hidden>{size.text}</span><span className="sr-only">{size.aria}</span> · </> : null}
        <span className="yard-num">made {row.count}×</span>
      </span>
    </button>
  );
}
