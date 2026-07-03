/**
 * Timesheet date/week utility functions.
 * Week always starts on Sunday and ends on Friday (no Saturday per spec).
 */

/**
 * Given any date, return the Sunday that starts that week.
 * If the given date is a Saturday, it returns the Sunday of the *next* week
 * (since Saturday is excluded from timesheets).
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 6) {
    // Saturday -> advance to next Sunday
    d.setDate(d.getDate() + 1);
  } else {
    // Go back to Sunday
    d.setDate(d.getDate() - dayOfWeek);
  }
  return d;
}

/**
 * Given a weekStart (Sunday), return the weekEnd (Friday).
 */
export function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 5); // Sunday + 5 = Friday
  return d;
}

/**
 * Navigate to the previous week's Sunday.
 */
export function getPreviousWeekStart(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() - 7);
  return d;
}

/**
 * Navigate to the next week's Sunday.
 */
export function getNextWeekStart(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

/**
 * Format a week range for display: "23 Jun – 28 Jun 2026"
 */
export function formatWeekRange(weekStart: Date): string {
  const end = getWeekEnd(weekStart);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const startStr = weekStart.toLocaleDateString("en-AU", opts);
  const endStr = end.toLocaleDateString("en-AU", {
    ...opts,
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

/**
 * Get an array of the 6 dates (Sun–Fri) for a given week start.
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Return ISO date string (YYYY-MM-DD) from a Date.
 */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
