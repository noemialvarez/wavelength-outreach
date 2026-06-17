import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Checkbox } from "./checkbox";
import { Button } from "./button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const display =
    value.length === 0 ? placeholder : value.join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between font-normal h-9 px-3",
            className
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[160px] w-auto p-1" align="start">
        <div className="max-h-60 overflow-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggle(opt.value);
              }}
            >
              <Checkbox
                checked={value.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
