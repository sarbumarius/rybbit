"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { goBack, goForward, useStore } from "@/lib/store";
import { FilterParameter } from "@rybbit/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime } from "luxon";
import { Filters } from "./Filters/Filters";

import { DateSelector } from "../../../../components/DateSelector/DateSelector";
import { Time } from "../../../../components/DateSelector/types";
import { NewFilterButton } from "./Filters/NewFilterButton";
import { LiveUserCount } from "./LiveUserCount";
import { MobileSidebar } from "../Sidebar/MobileSidebar";

const canGoForward = (time: Time) => {
  const currentDay = DateTime.now().startOf("day");
  if (time.mode === "day") {
    return !(DateTime.fromISO(time.day).startOf("day") >= currentDay);
  }

  if (time.mode === "range") {
    return !(DateTime.fromISO(time.endDate).startOf("day") >= currentDay);
  }

  if (time.mode === "week") {
    return !(DateTime.fromISO(time.week).startOf("week") >= currentDay);
  }

  if (time.mode === "month") {
    return !(DateTime.fromISO(time.month).startOf("month") >= currentDay);
  }

  if (time.mode === "year") {
    return !(DateTime.fromISO(time.year).startOf("year") >= currentDay);
  }

  return false;
};

export function SubHeader({ availableFilters }: { availableFilters?: FilterParameter[] }) {
  const { time, setTime } = useStore();
  // Local toggles for showing products and campaigns, persisted in localStorage (default: true)
  const [showProducts, setShowProducts] = React.useState<boolean>(true);
  const [showCampaigns, setShowCampaigns] = React.useState<boolean>(true);

  React.useEffect(() => {
    try {
      const sp = localStorage.getItem("analytics.showProducts");
      const sc = localStorage.getItem("analytics.showCampaigns");
      setShowProducts(sp === null ? true : sp !== "0");
      setShowCampaigns(sc === null ? true : sc !== "0");
    } catch {}
  }, []);

  const updateStorageAndBroadcast = (key: string, value: boolean) => {
    try {
      localStorage.setItem(key, value ? "1" : "0");
      // Notify other components in same tab
      window.dispatchEvent(new Event("analytics:visibility-toggles-update"));
    } catch {}
  };

  return (
    <div className="z-20 fixed bottom-0 max-w-[1400px]  bg-neutral-900   border-1 border-neutral-600 border border-t-1 border-b-0 rounded-t-2xl w-full  mx-auto pt-3 pb-0 px-3"

>
      <div className="flex gap-2 mb-3 justify-between">
        <div className="flex items-center gap-2">
          <MobileSidebar />
          <div className="hidden md:block">
            <NewFilterButton availableFilters={availableFilters} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LiveUserCount />
          <DateSelector time={time} setTime={setTime} />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goBack}
              disabled={time.mode === "past-minutes"}
              className="rounded-r-none h-8 w-8 sm:h-9 sm:w-9"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goForward}
              disabled={!canGoForward(time)}
              className="rounded-l-none -ml-px h-8 w-8 sm:h-9 sm:w-9"
            >
              <ChevronRight />
            </Button>

            {/* Custom visibility toggles */}
            <div className="filtreCustom  items-center gap-1 ml-2 hidden md:flex">
              <div className="flex items-center gap-2" title="Toggle product visuals (badges and visited products)">
                <span className="text-xs text-neutral-300">Products</span>
                <Switch
                  checked={showProducts}
                  onCheckedChange={(checked) => {
                    setShowProducts(checked);
                    updateStorageAndBroadcast("analytics.showProducts", checked);
                  }}
                />
              </div>
              <div className="flex items-center gap-2" title="Toggle campaign query badges (fbclid, gclid, utm_*)">
                <span className="text-xs text-neutral-300">Campaigns</span>
                <Switch
                  checked={showCampaigns}
                  onCheckedChange={(checked) => {
                    setShowCampaigns(checked);
                    updateStorageAndBroadcast("analytics.showCampaigns", checked);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="md:hidden">
          <NewFilterButton availableFilters={availableFilters} />
        </div>
        <Filters availableFilters={availableFilters} />
      </div>

    </div>
  );
}
