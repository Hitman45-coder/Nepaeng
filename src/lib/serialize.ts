import { Prisma } from "@prisma/client";

/**
 * Convert Prisma Decimal values to plain numbers so they can cross the
 * server -> client component boundary safely.
 */
export function decToNum(
  value: Prisma.Decimal | number | string | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  return Number(value.toString());
}
