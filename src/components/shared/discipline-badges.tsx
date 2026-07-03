import { Discipline } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  FIRE: "Fire",
  MECHANICAL: "Mechanical",
  HYDRAULICS: "Hydraulics",
  ELECTRICAL: "Electrical",
  STORMWATER: "Stormwater",
};

const COLOURS: Record<Discipline, string> = {
  FIRE: "bg-red-100 text-red-700",
  MECHANICAL: "bg-blue-100 text-blue-700",
  HYDRAULICS: "bg-cyan-100 text-cyan-700",
  ELECTRICAL: "bg-amber-100 text-amber-700",
  STORMWATER: "bg-indigo-100 text-indigo-700",
};

export function DisciplineBadges({
  disciplines,
}: {
  disciplines: Discipline[];
}) {
  if (!disciplines?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {disciplines.map((d) => (
        <span
          key={d}
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
            COLOURS[d]
          )}
        >
          {DISCIPLINE_LABELS[d]}
        </span>
      ))}
    </div>
  );
}

export const ALL_DISCIPLINES = Object.values(Discipline);
