"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Discipline } from "@prisma/client";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { GanttChart, type GanttTask } from "@/components/gantt/gantt-chart";
import {
  DISCIPLINE_LABELS,
  ALL_DISCIPLINES,
} from "@/components/shared/discipline-badges";
import { formatDate, toISODate } from "@/lib/utils";
import type { CommentDetail } from "./types";

type ViewMode = "Day" | "Week" | "Month";

export function SchedulePanel({
  projectId,
  comments,
  canComment,
  currentUserId,
}: {
  projectId: string;
  comments: CommentDetail[];
  canComment: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const [adding, setAdding] = useState(false);

  // new task form
  const [text, setText] = useState("");
  const [start, setStart] = useState(toISODate(new Date()));
  const [end, setEnd] = useState(toISODate(new Date(Date.now() + 6 * 864e5)));
  const [discipline, setDiscipline] = useState<Discipline | "none">("none");
  const [progress, setProgress] = useState("0");

  const tasks: GanttTask[] = useMemo(
    () =>
      comments.map((c) => ({
        id: c.id,
        name: `${c.text}${c.discipline ? ` (${DISCIPLINE_LABELS[c.discipline]})` : ""}`,
        start: c.ganttStart.slice(0, 10),
        end: c.ganttEnd.slice(0, 10),
        progress: c.progressPct,
      })),
    [comments]
  );

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          ganttStart: start,
          ganttEnd: end,
          progressPct: Number(progress),
          discipline: discipline === "none" ? null : discipline,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Could not add task", description: data.error, variant: "error" });
        return;
      }
      setText("");
      setProgress("0");
      setDiscipline("none");
      toast({ title: "Task added", variant: "success" });
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function patchComment(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/comments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Update failed", description: data.error, variant: "error" });
      return false;
    }
    router.refresh();
    return true;
  }

  async function onDateChange(id: string, s: Date, e: Date) {
    if (!canComment) return;
    await patchComment(id, {
      ganttStart: s.toISOString(),
      ganttEnd: e.toISOString(),
    });
  }

  async function onProgressChange(id: string, p: number) {
    if (!canComment) return;
    await patchComment(id, { progressPct: Math.round(p) });
  }

  async function remove(id: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Delete failed", description: data.error, variant: "error" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Programme (Gantt)</CardTitle>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Day">Day</SelectItem>
              <SelectItem value="Week">Week</SelectItem>
              <SelectItem value="Month">Month</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <GanttChart
            tasks={tasks}
            viewMode={viewMode}
            readOnly={!canComment}
            onDateChange={onDateChange}
            onProgressChange={onProgressChange}
          />
          {canComment && (
            <p className="mt-2 text-xs text-muted-foreground">
              Drag bars to reschedule, or drag the right edge of a bar to update
              progress.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasks & comments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          )}
          {comments.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(c.ganttStart)} → {formatDate(c.ganttEnd)} ·{" "}
                  {c.progressPct}% ·{" "}
                  {c.discipline ? DISCIPLINE_LABELS[c.discipline] : "General"} ·{" "}
                  {c.userName}
                </p>
              </div>
              {canComment && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(c.id)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}

          {canComment && (
            <form
              onSubmit={addTask}
              className="space-y-3 rounded-md border border-dashed p-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="t-text">New task / comment</Label>
                <Textarea
                  id="t-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Hydraulic services design & calculations"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="t-start">Start</Label>
                  <Input
                    id="t-start"
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-end">End</Label>
                  <Input
                    id="t-end"
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="t-prog">Progress %</Label>
                  <Input
                    id="t-prog"
                    type="number"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Discipline</Label>
                  <Select
                    value={discipline}
                    onValueChange={(v) => setDiscipline(v as Discipline | "none")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General</SelectItem>
                      {ALL_DISCIPLINES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {DISCIPLINE_LABELS[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={adding}>
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add task
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
