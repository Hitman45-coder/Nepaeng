"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectRef {
  id: string;
  projectNumber: string;
  projectName: string;
}

/**
 * Searchable project dropdown for the timesheet grid.
 * Fetches from /api/timesheets/projects?q=... as the user types.
 * Excludes projects already in the grid (by excludeIds).
 */
export function ProjectSearchDropdown({
  onSelect,
  excludeIds = [],
}: {
  onSelect: (project: ProjectRef) => void;
  excludeIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/timesheets/projects?q=${encodeURIComponent(q)}`
        );
        if (res.ok) {
          const data = await res.json();
          // Filter out already-selected projects
          const filtered = (data.projects as ProjectRef[]).filter(
            (p) => !excludeIds.includes(p.id)
          );
          setResults(filtered);
          setHighlightIdx(0);
        }
      } finally {
        setLoading(false);
      }
    },
    [excludeIds]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 0 && open) {
      debounceRef.current = setTimeout(() => search(query), 250);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, search]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlightIdx]) {
        onSelect(results[highlightIdx]);
        setOpen(false);
        setQuery("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1.5 rounded-md border border-input px-2 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            search(query);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search projects…"
          className="w-full min-w-[180px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full min-w-[280px] overflow-auto rounded-md border bg-popover shadow-md">
          {loading && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Searching…
            </p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No matching projects found.
            </p>
          )}
          {results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(p);
                setOpen(false);
                setQuery("");
              }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                i === highlightIdx && "bg-accent"
              )}
            >
              <span className="font-medium text-primary">
                {p.projectNumber}
              </span>
              <span className="truncate text-muted-foreground">
                {p.projectName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
