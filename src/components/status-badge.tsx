import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "turquoise" | "pink" | "blue" | "muted" | "amber";

const toneClass: Record<Tone, string> = {
  turquoise: "bg-brand-turquoise/15 text-brand-turquoise border-brand-turquoise/30",
  pink: "bg-primary/10 text-primary border-primary/30",
  blue: "bg-brand-blue/15 text-brand-blue border-brand-blue/30",
  muted: "bg-muted text-muted-foreground border-border",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
};

export function StatusBadge({
  label,
  tone = "turquoise",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", toneClass[tone])}>
      {label}
    </Badge>
  );
}
