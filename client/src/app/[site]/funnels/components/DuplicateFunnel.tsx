"use client";

import { FunnelStep, useGetFunnel, useSaveFunnel } from "../../../../api/analytics/funnels/useGetFunnel";
import { SavedFunnel } from "../../../../api/analytics/funnels/useGetFunnels";
import { Time } from "@/components/DateSelector/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStartAndEndDate } from "../../../../api/utils";
import { Filter } from "@rybbit/shared";
import { FunnelForm } from "./FunnelForm";

interface DuplicateFunnelDialogProps {
  source: SavedFunnel;
  isOpen: boolean;
  onClose: () => void;
}

export function DuplicateFunnelDialog({ source, isOpen, onClose }: DuplicateFunnelDialogProps) {
  // Time state - initialized to today
  const [time, setTime] = useState<Time>({
    mode: "day",
    day: DateTime.now().toISODate(),
  });

  // Steps/filters/name initialized from source funnel
  const [steps, setSteps] = useState<FunnelStep[]>(source.steps);
  const [filters, setFilters] = useState<Filter[]>(source.filters || []);
  const [name, setName] = useState(`${source.name} (copy)`);

  const { startDate, endDate } = getStartAndEndDate(time);

  // Preview query for visualization
  const { data, isError, error, isLoading: isPending } = useGetFunnel(
    {
      steps,
      startDate,
      endDate,
      filters,
    },
    true
  );

  const { mutate: saveFunnel, isPending: isSaving, error: saveError } = useSaveFunnel();

  const handleQueryFunnel = () => {
    const hasEmptySteps = steps.some(step => !step.value);
    if (hasEmptySteps) {
      alert("All steps must have values");
      return;
    }
  };

  const handleCreateDuplicate = () => {
    // Validate
    if (!name.trim()) {
      alert("Please enter a funnel name");
      return;
    }
    const hasEmptySteps = steps.some(step => !step.value);
    if (hasEmptySteps) {
      alert("All steps must have values");
      return;
    }

    // Determine dates from selected time
    let s = "", e = "";
    if (time.mode === "range") {
      s = time.startDate; e = time.endDate;
    } else if (time.mode === "day") {
      s = time.day; e = time.day;
    } else if (time.mode === "week") {
      s = time.week; e = DateTime.fromISO(time.week).plus({ days: 6 }).toISODate() || DateTime.now().toISODate();
    } else if (time.mode === "month") {
      s = time.month; e = DateTime.fromISO(time.month).endOf("month").toISODate() || DateTime.now().toISODate();
    } else if (time.mode === "year") {
      s = time.year; e = DateTime.fromISO(time.year).endOf("year").toISODate() || DateTime.now().toISODate();
    } else {
      s = DateTime.now().minus({ days: 7 }).toISODate();
      e = DateTime.now().toISODate();
    }

    // Create new funnel (no reportId)
    saveFunnel(
      {
        steps,
        startDate: s,
        endDate: e,
        name,
        filters: filters.length > 0 ? filters : undefined,
      },
      {
        onSuccess: () => {
          onClose();
          toast?.success("Funnel duplicated successfully");
        },
        onError: (err) => {
          toast?.error(`Failed to duplicate funnel: ${err.message}`);
        },
      }
    );
  };

  // Reset local state when the dialog opens with a (possibly) new source
  useEffect(() => {
    if (isOpen) {
      setSteps(source.steps);
      setFilters(source.filters || []);
      setName(`${source.name} (copy)`);
    }
  }, [isOpen, source]);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicate Funnel</DialogTitle>
        </DialogHeader>

        <FunnelForm
          name={name}
          setName={setName}
          steps={steps}
          setSteps={setSteps}
          time={time}
          setTime={setTime}
          filters={filters}
          setFilters={setFilters}
          onSave={handleCreateDuplicate}
          onCancel={onClose}
          onQuery={handleQueryFunnel}
          saveButtonText="Create Funnel"
          isSaving={isSaving}
          isError={isError}
          isPending={isPending}
          error={error}
          saveError={saveError}
          funnelData={data}
        />
      </DialogContent>
    </Dialog>
  );
}
