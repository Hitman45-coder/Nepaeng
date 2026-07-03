import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number/Decimal-ish value as AUD currency. */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** ISO yyyy-mm-dd (date only) — handy for <input type="date"> and frappe-gantt. */
export function toISODate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

/** Generate a readable temporary password for admin-created users. */
export function generateTempPassword(): string {
  const adjectives = ["Swift", "Bright", "Solid", "Prime", "Clear", "Bold"];
  const nouns = ["Hydrant", "Riser", "Valve", "Pump", "Sensor", "Beam"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  const sym = "!@#$%".charAt(Math.floor(Math.random() * 5));
  return `${a}-${n}-${num}${sym}`;
}
