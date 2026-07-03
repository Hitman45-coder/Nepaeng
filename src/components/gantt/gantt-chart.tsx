"use client";

import { useEffect, useRef } from "react";
import "frappe-gantt/dist/frappe-gantt.css";

export interface GanttTask {
  id: string;
  name: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  progress: number;
  custom_class?: string;
}

type ViewMode = "Day" | "Week" | "Month";

interface FrappeTask {
  id: string;
  start: Date;
  end: Date;
}

export function GanttChart({
  tasks,
  viewMode = "Week",
  readOnly = false,
  onDateChange,
  onProgressChange,
  onClick,
}: {
  tasks: GanttTask[];
  viewMode?: ViewMode;
  readOnly?: boolean;
  onDateChange?: (id: string, start: Date, end: Date) => void;
  onProgressChange?: (id: string, progress: number) => void;
  onClick?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the latest callbacks without forcing the chart to re-instantiate.
  const cbRef = useRef({ onDateChange, onProgressChange, onClick });
  cbRef.current = { onDateChange, onProgressChange, onClick };

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    (async () => {
      const mod = await import("frappe-gantt");
      const Gantt = (mod.default ?? mod) as unknown as new (
        wrapper: HTMLElement,
        tasks: GanttTask[],
        options: Record<string, unknown>
      ) => unknown;

      if (cancelled || !el) return;
      el.innerHTML = "";
      if (tasks.length === 0) return;

      new Gantt(el, tasks, {
        view_mode: viewMode,
        date_format: "YYYY-MM-DD",
        bar_height: 22,
        padding: 16,
        readonly: readOnly,
        on_date_change: (task: FrappeTask, start: Date, end: Date) =>
          cbRef.current.onDateChange?.(task.id, start, end),
        on_progress_change: (task: FrappeTask, progress: number) =>
          cbRef.current.onProgressChange?.(task.id, progress),
        on_click: (task: FrappeTask) => cbRef.current.onClick?.(task.id),
      });
    })();

    return () => {
      cancelled = true;
      if (el) el.innerHTML = "";
    };
  }, [tasks, viewMode, readOnly]);

  if (tasks.length === 0) {
    return (
      <div className="gantt-container flex h-40 items-center justify-center p-4 text-sm text-muted-foreground">
        No scheduled tasks yet.
      </div>
    );
  }

  return (
    <div className="gantt-container overflow-x-auto p-2">
      <div ref={containerRef} />
    </div>
  );
}
