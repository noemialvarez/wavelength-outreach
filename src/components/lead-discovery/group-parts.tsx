import { ChevronDown, ChevronUp } from "lucide-react";

// How many leads a list shows before "Show all".
export const PREVIEW_COUNT = 3;

// The title of a lead list, in the same style as the option boxes above it:
// a small "OPTION 1" label over a bold title, with the lead count beside it.
export function GroupTitle({
  eyebrow,
  title,
  count,
}: {
  eyebrow?: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="min-w-0">
      {eyebrow && (
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-turquoise">
          {eyebrow}
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground">
            {count} {count === 1 ? "lead" : "leads"}
          </span>
        )}
      </div>
    </div>
  );
}

// "Show all N" / "Show fewer" under a list that only shows its first few rows.
export function ShowMoreToggle({
  total,
  expanded,
  onToggle,
  preview = PREVIEW_COUNT,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  preview?: number;
}) {
  if (total <= preview) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/5"
    >
      {expanded ? (
        <>
          <ChevronUp className="h-4 w-4" /> Show fewer
        </>
      ) : (
        <>
          <ChevronDown className="h-4 w-4" /> Show all {total} leads ({total - preview} more)
        </>
      )}
    </button>
  );
}
