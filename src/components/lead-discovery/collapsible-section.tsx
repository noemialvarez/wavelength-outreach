import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type CollapsibleSectionProps = {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  headerExtra?: ReactNode;
  // Always visible regardless of collapse state — the button that triggers
  // the section's main action (e.g. "Find matching ICP").
  primaryAction?: ReactNode;
  // Always visible regardless of collapse state, rendered after primaryAction
  // — for persistent results (e.g. search results) that shouldn't hide when
  // the input fields collapse.
  footer?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function CollapsibleSection({
  eyebrow,
  title,
  description,
  badge,
  headerExtra,
  primaryAction,
  footer,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="p-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start justify-between gap-3">
          <CollapsibleTrigger className="group flex flex-1 items-start gap-2 text-left">
            <div className="flex-1">
              {eyebrow && (
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-turquoise">
                  {eyebrow}
                </div>
              )}
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{title}</h2>
                {badge}
              </div>
              {description && open && (
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          {headerExtra}
        </div>
        <CollapsibleContent>
          <div className="pt-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
      {primaryAction && <div className="flex justify-end pt-4">{primaryAction}</div>}
      {footer}
    </Card>
  );
}
