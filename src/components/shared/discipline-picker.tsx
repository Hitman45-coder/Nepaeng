"use client";

import { Discipline } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ALL_DISCIPLINES, DISCIPLINE_LABELS } from "./discipline-badges";

export function DisciplinePicker({
  value,
  onChange,
  disabled,
}: {
  value: Discipline[];
  onChange: (next: Discipline[]) => void;
  disabled?: boolean;
}) {
  function toggle(d: Discipline) {
    if (disabled) return;
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_DISCIPLINES.map((d) => {
        const active = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            disabled={disabled}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            {DISCIPLINE_LABELS[d]}
          </button>
        );
      })}
    </div>
  );
}
