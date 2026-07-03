"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plug, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/shared/page-header";
import { formatDate } from "@/lib/utils";

export function MyobSettingsClient({
  connected,
  companyFileId,
  expiresAt,
  updatedAt,
  unpaidInvoiced,
}: {
  connected: boolean;
  companyFileId: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  unpaidInvoiced: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const [polling, setPolling] = useState(false);

  const justConnected = params.get("connected") === "1";
  const error = params.get("error");

  async function pollNow() {
    setPolling(true);
    try {
      const res = await fetch("/api/myob/poll", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Poll failed", description: data.error, variant: "error" });
        return;
      }
      toast({
        title: "Poll complete",
        description: `Checked ${data.checked}, updated ${data.updated}`,
        variant: "success",
      });
      router.refresh();
    } finally {
      setPolling(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="MYOB Integration"
        description="Connect your MYOB company file to raise invoices and sync payment status."
      />

      {justConnected && (
        <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          MYOB connected successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          Connection error: {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Connection</CardTitle>
            {connected ? (
              <Badge variant="success">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Connected
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Not connected
              </Badge>
            )}
          </div>
          <CardDescription>
            OAuth2 authorization with MYOB Business / AccountRight.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {connected && (
            <div className="grid grid-cols-2 gap-3">
              <Info label="Company file ID" value={companyFileId || "—"} />
              <Info label="Token expires" value={formatDate(expiresAt)} />
              <Info label="Last updated" value={formatDate(updatedAt)} />
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant={connected ? "outline" : "default"}>
              <a href="/api/myob/authorize">
                <Plug className="h-4 w-4" />
                {connected ? "Reconnect MYOB" : "Connect MYOB"}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Payment status polling</CardTitle>
          <CardDescription>
            A background job (node-cron) checks invoiced-but-unpaid projects on a
            schedule. You can also run it manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Currently <span className="font-medium text-foreground">{unpaidInvoiced}</span>{" "}
            invoiced project(s) awaiting payment.
          </p>
          <Button onClick={pollNow} disabled={polling || !connected} variant="outline">
            {polling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Poll payment status now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
