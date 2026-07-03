"use client";

import Link from "next/link";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DisciplineBadges } from "@/components/shared/discipline-badges";
import { ScopePanel } from "./scope-panel";
import { FinancialsPanel } from "./financials-panel";
import { SchedulePanel } from "./schedule-panel";
import type {
  CommentDetail,
  Permissions,
  ProjectDetail,
  SessionInfo,
} from "./types";

export function ProjectDetailClient({
  project,
  permissions,
  session,
  engineers,
  comments,
}: {
  project: ProjectDetail;
  permissions: Permissions;
  session: SessionInfo;
  engineers: { id: string; name: string }[];
  comments: CommentDetail[];
}) {
  return (
    <div>
      <Link
        href="/projects"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {project.projectName}
            </h2>
            <Badge variant="secondary">{project.projectNumber}</Badge>
            {project.isIssuedOut && <Badge variant="success">Issued</Badge>}
          </div>
          <div className="mt-2">
            <DisciplineBadges disciplines={project.scopeOfWork} />
          </div>
          {project.proposal && (
            <p className="mt-2 text-xs text-muted-foreground">
              Converted from proposal {project.proposal.proposalNumber}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="scope">
        <TabsList>
          <TabsTrigger value="scope">Scope</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          {permissions.showFinancials && (
            <TabsTrigger value="financials">Financials</TabsTrigger>
          )}
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
        </TabsList>

        <TabsContent value="scope">
          <ScopePanel
            project={project}
            canEdit={permissions.canEditScope}
            engineers={engineers}
          />
        </TabsContent>

        <TabsContent value="schedule">
          <SchedulePanel
            projectId={project.id}
            comments={comments}
            canComment={permissions.canComment}
            currentUserId={session.id}
          />
        </TabsContent>

        {permissions.showFinancials && (
          <TabsContent value="financials">
            <FinancialsPanel
              project={project}
              canEdit={permissions.canEditFinancials}
            />
          </TabsContent>
        )}

        <TabsContent value="timesheets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Timesheets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Time is now logged via the weekly Timesheet module. Engineers
                fill a full weekly grid (Sun–Fri, 42 hours) against their
                assigned projects and submit for manager approval.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/timesheets">
                    <Clock className="h-4 w-4" />
                    Open My Timesheet
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/timesheets/history">
                    <ExternalLink className="h-4 w-4" />
                    View History
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
