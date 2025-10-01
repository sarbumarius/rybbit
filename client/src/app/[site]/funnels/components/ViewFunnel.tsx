"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Time } from "@/components/DateSelector/types";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { getStartAndEndDate } from "../../../../api/utils";
import { useGetFunnel } from "../../../../api/analytics/funnels/useGetFunnel";
import { SavedFunnel } from "../../../../api/analytics/funnels/useGetFunnels";
import { ThreeDotLoader } from "@/components/Loaders";
import { Funnel } from "./Funnel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw } from "lucide-react";

interface ViewFunnelDialogProps {
  funnel: SavedFunnel;
  isOpen: boolean;
  onClose: () => void;
}

export function ViewFunnelDialog({ funnel, isOpen, onClose }: ViewFunnelDialogProps) {
  // Local time range state (default last 7 days)
  const [time, setTime] = useState<Time>({
    mode: "day",
    day: DateTime.now().toISODate(),
  });

  // Compute start/end for API
  const { startDate, endDate } = getStartAndEndDate(time);

  const { data, isError, error, isLoading: isPending, isFetching, refetch } = useGetFunnel(
    {
      steps: funnel.steps,
      startDate,
      endDate,
      filters: funnel.filters,
    },
    true
  );

  // Auto-refresh state and last updated time
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // When dialog opens, ensure time is reset to last 7 days for a consistent view
  useEffect(() => {
    if (isOpen) {
      setTime({
        mode: "day",
        day: DateTime.now().toISODate(),
      } as Time);
      // mark initial open time
      setLastUpdatedAt(Date.now());
    }
  }, [isOpen]);

  // Setup 5s auto refresh while dialog is open and autoRefresh enabled
  useEffect(() => {
    if (!isOpen || !autoRefresh) return;
    const id = setInterval(() => {
      refetch().then(() => setLastUpdatedAt(Date.now())).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [isOpen, autoRefresh, refetch]);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 pt-4 pb-2">
            <DialogTitle>View Funnel — {funnel.name}</DialogTitle>
          </DialogHeader>

          {/* Toolbar: auto refresh + manual refresh */}
          <div className="px-6 pb-2 flex items-center justify-between text-xs text-neutral-500">
            <div>{lastUpdatedAt ? `Last updated: ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Auto 5s</span>
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={isFetching}
                onClick={async () => {
                  try {
                    await refetch();
                    setLastUpdatedAt(Date.now());
                  } catch {}
                }}
                title="Refresh now"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {isPending ? (
              <ThreeDotLoader className="h-[400px]" />
            ) : isError ? (
              <div className="text-red-500 p-4 text-center">
                Error loading funnel: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : data && data.length > 0 ? (
              <Funnel data={data} isError={!!isError} error={error} isPending={isPending} time={time} setTime={setTime} layoutMode="grid" autoOpenEntries />
            ) : (
              <div className="text-center p-6 text-neutral-500">No funnel data available</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
