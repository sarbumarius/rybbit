"use client";

import { useDeleteFunnel } from "../../../../api/analytics/funnels/useDeleteFunnel";
import { useGetFunnel } from "../../../../api/analytics/funnels/useGetFunnel";
import { SavedFunnel } from "../../../../api/analytics/funnels/useGetFunnels";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { DateRangeMode, Time } from "@/components/DateSelector/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Edit,
  FileText,
  FilterIcon,
  MousePointerClick,
  Trash2,
  Copy,
  RefreshCw,
  Eye,
} from "lucide-react";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStartAndEndDate } from "../../../../api/utils";
import { ThreeDotLoader } from "../../../../components/Loaders";
import { useGetRegionName } from "../../../../lib/geo";
import { cn } from "../../../../lib/utils";
import {
  filterTypeToLabel,
  getParameterNameLabel,
  getParameterValueLabel,
} from "../../components/shared/Filters/utils";
import { EditFunnelDialog } from "./EditFunnel";
import { DuplicateFunnelDialog } from "./DuplicateFunnel";
import { ViewFunnelDialog } from "./ViewFunnel";
import { Funnel } from "./Funnel";

interface FunnelRowProps {
  funnel: SavedFunnel;
  orderValue?: number;
  onOrderChange?: (val?: number) => void;
}

export function FunnelRow({ funnel, orderValue, onOrderChange }: FunnelRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const { getRegionName } = useGetRegionName();

  // Time state for funnel visualization - default to last 7 days
  const [time, setTime] = useState<Time>({
    mode: "day",
    day: DateTime.now().toISODate(),
  });

  const { startDate, endDate } = getStartAndEndDate(time);

  // Funnel data fetching
  const {
    data,
    isError,
    error,
    isLoading: isPending,
    isSuccess,
    isFetching,
    refetch,
  } = useGetFunnel(
    expanded
      ? {
          steps: funnel.steps,
          startDate,
          endDate,
          filters: funnel.filters,
        }
      : undefined
  );

  // Delete funnel mutation
  const { mutate: deleteFunnel, isPending: isDeleting } = useDeleteFunnel();

  // Handle expansion
  const handleExpand = () => {
    setExpanded(!expanded);
  };

  // Auto-refresh state and last updated
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Setup 5s auto refresh while expanded
  useEffect(() => {
    if (!expanded || !autoRefresh) return;
    const id = setInterval(() => {
      refetch().then(() => setLastUpdatedAt(Date.now())).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [expanded, autoRefresh, refetch]);

  // Handle funnel deletion
  const handleDeleteFunnel = async () => {
    try {
      await deleteFunnel(funnel.id);
      toast.success("Funnel deleted successfully");
    } catch (error) {
      console.error("Error deleting funnel:", error);
      throw error; // Let the ConfirmationModal handle the error display
    }
  };

  // Check if funnel has filters
  const hasFilters = funnel.filters && funnel.filters.length > 0;

  return (
    <Card className="mb-4 overflow-hidden">
      {/* Header row (always visible) */}
      <div className="flex items-center justify-between py-2 px-5">
        <div
          className="flex items-center flex-grow cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
          onClick={handleExpand}
        >
          <div className="mt-1 text-xs text-neutral-400 flex flex-col gap-3">
            {/* Steps visualization */}
              <h3 className="font-medium text-neutral-100 text-base mr-2">{funnel.name}</h3>

              <div className="flex flex-wrap gap-1">
              {funnel.steps.map((step, index) => (
                <div key={index} className="flex items-center">
                  {index > 0 && <ArrowRight className="h-3 w-3 mx-1 text-neutral-400" />}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 whitespace-nowrap overflow-hidden text-ellipsis flex items-center cursor-default">
                        {step.type === "page" ? (
                          <FileText className="h-3 w-3 mr-1 text-blue-400" />
                        ) : (
                          <MousePointerClick className="h-3 w-3 mr-1 text-amber-400" />
                        )}
                        <span className="max-w-[120px] overflow-hidden text-ellipsis inline-block">
                          {step.name || step.value}
                          {step.type === "event" && step.eventPropertyKey && (
                            <span className="text-xs text-yellow-400 ml-1">*</span>
                          )}
                        </span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <div>
                        <span className="font-semibold">{step.type === "page" ? "Page" : "Event"}:</span> {step.value}
                      </div>
                      {step.name && (
                        <div>
                          <span className="font-semibold">Label:</span> {step.name}
                        </div>
                      )}
                      {step.type === "event" && step.eventPropertyKey && step.eventPropertyValue !== undefined && (
                        <div>
                          <span className="font-semibold">Property:</span> {step.eventPropertyKey} ={" "}
                          {String(step.eventPropertyValue)}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>

            {/* Filters visualization */}
            {hasFilters && (
              <div className="flex items-center gap-1">
                <FilterIcon className="h-3 w-3 text-neutral-400" />
                <div className="flex flex-wrap gap-1">
                  {funnel.filters?.map((filter, index) => (
                    <span
                      key={index}
                      className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 whitespace-nowrap overflow-hidden text-ellipsis flex items-center cursor-default"
                    >
                      <span className="text-neutral-300">{getParameterNameLabel(filter.parameter)}</span>
                      <span
                        className={cn(
                          "mx-1",
                          filter.type === "not_equals" || filter.type === "not_contains"
                            ? "text-red-400"
                            : "text-emerald-400"
                        )}
                      >
                        {filterTypeToLabel(filter.type)}
                      </span>
                      <span className="text-neutral-100 max-w-[100px] overflow-hidden text-ellipsis inline-block">
                        {filter.value.length > 0 ? getParameterValueLabel(filter, getRegionName) : "empty"}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex">
            {/* Edit button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation();
                setIsEditModalOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>

            {/* Order input next to Edit */}
            {onOrderChange !== undefined && (
              <div className="ml-1 flex items-center gap-1">
                <label className="sr-only">Ordine</label>
                <input
                  type="number"
                  min={1}
                  value={orderValue ?? ""}
                  placeholder="-"
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) onOrderChange(undefined);
                    else {
                      const n = parseInt(val, 10);
                      if (isNaN(n) || n < 1) onOrderChange(undefined);
                      else onOrderChange(n);
                    }
                  }}
                  className="w-16 h-8 px-2 py-1 rounded border border-neutral-800 bg-neutral-900 text-neutral-200 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-500"
                  title="Ordine"
                />
              </div>
            )}

            {/* View button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation();
                setIsViewModalOpen(true);
              }}
              title="View"
            >
              <Eye className="h-4 w-4" />
            </Button>

            {/* Duplicate button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation();
                setIsDuplicateModalOpen(true);
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={e => {
                e.stopPropagation();
                setIsDeleteModalOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" onClick={handleExpand}>
              {expanded ? <ChevronUp strokeWidth={3} /> : <ChevronDown strokeWidth={3} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          <div className="p-4">
            {/* Refresh controls */}
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-neutral-500">
                {lastUpdatedAt ? `Last updated: ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ""}
              </div>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Auto 5s</span>
                  <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={isFetching}
                  onClick={async e => {
                    e.stopPropagation();
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

            {isPending ? (
              <ThreeDotLoader className="h-[400px]" />
            ) : isError ? (
              <div className="text-red-500 p-4 text-center">
                Error loading funnel: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : data && data.length > 0 ? (
              <Funnel data={data} isError={isError} error={error} isPending={isPending} time={time} setTime={setTime} />
            ) : (
              <div className="text-center p-6 text-neutral-500">No funnel data available</div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        title="Delete Funnel"
        description={`Are you sure you want to delete "${funnel.name}"? This action cannot be undone.`}
        isOpen={isDeleteModalOpen}
        setIsOpen={setIsDeleteModalOpen}
        onConfirm={handleDeleteFunnel}
        primaryAction={{
          children: isDeleting ? "Deleting..." : "Delete",
          variant: "destructive",
        }}
      />

      {/* Edit Funnel Modal */}
      {isEditModalOpen && (
        <EditFunnelDialog funnel={funnel} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
      )}

      {/* Duplicate Funnel Modal */}
      {isDuplicateModalOpen && (
        <DuplicateFunnelDialog source={funnel} isOpen={isDuplicateModalOpen} onClose={() => setIsDuplicateModalOpen(false)} />
      )}

      {/* View Funnel Modal */}
      {isViewModalOpen && (
        <ViewFunnelDialog funnel={funnel} isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} />
      )}
    </Card>
  );
}
