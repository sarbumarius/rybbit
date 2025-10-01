"use client";

import GoalCard from "./GoalCard";
import { Goal } from "../../../../api/analytics/goals/useGetGoals";
import { useState, useEffect } from "react";

interface GoalsListProps {
  goals: Goal[];
  siteId: number;
}

function getBaseName(name: string | null): string {
  if (!name) return "";
  const parts = name.split(" - ");
  return parts[0]?.trim() || name.trim();
}

function isSecondary(name: string | null): boolean {
  if (!name) return false;
  return name.includes(" - ");
}

export default function GoalsList({ goals, siteId }: GoalsListProps) {
  // Build grouping: base name => { primary?: Goal, secondaries: Goal[] }
  const groupOrder: string[] = [];
  const groups = new Map<string, { primary?: Goal; secondaries: Goal[] }>();

  for (const g of goals) {
    const base = getBaseName(g.name);
    if (!groups.has(base)) {
      groups.set(base, { secondaries: [] });
      groupOrder.push(base);
    }
    const entry = groups.get(base)!;
    if (isSecondary(g.name)) {
      entry.secondaries.push(g);
    } else {
      // If multiple primaries exist for same base, keep the one with more matches
      if (!entry.primary || g.total_conversions > entry.primary.total_conversions) {
        entry.primary = g;
      } else {
        // Treat additional primaries as secondaries to avoid losing them
        entry.secondaries.push(g);
      }
    }
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const storageKey = `goalsPrimaryOrder:${siteId}`;
  const [orderMap, setOrderMap] = useState<Record<string, number>>({});

  // Load saved order from localStorage (per site)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setOrderMap(parsed as Record<string, number>);
        }
      }
    } catch (e) {
      // ignore errors
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const saveOrderMap = (next: Record<string, number>) => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) {
      // ignore
    }
    setOrderMap(next);
  };

  const setBaseOrder = (base: string, value?: number) => {
    const v = value && value > 0 ? Math.floor(value) : undefined;
    const next = { ...orderMap } as Record<string, number>;
    if (v === undefined) {
      delete next[base];
    } else {
      next[base] = v;
    }
    saveOrderMap(next);
  };

  // Build an index to preserve original order where no custom order is set
  const originalIndex = new Map<string, number>();
  groupOrder.forEach((b, i) => originalIndex.set(b, i));

  const sortedBases = [...groupOrder].sort((a, b) => {
    const oa = orderMap[a];
    const ob = orderMap[b];
    if (oa != null && ob != null && oa !== ob) return oa - ob;
    if (oa != null && ob == null) return -1;
    if (oa == null && ob != null) return 1;
    return (originalIndex.get(a) || 0) - (originalIndex.get(b) || 0);
  });

  return (
    <div className="flex flex-col gap-3">
      {sortedBases.map(base => {
        const { primary, secondaries } = groups.get(base)!;
        const sortedSecondaries = [...secondaries].sort((a, b) => b.total_conversions - a.total_conversions);
        const hasSecondaries = sortedSecondaries.length > 0;
        const isOpen = !!openGroups[base];
        return (
          <div key={base} className="flex flex-col gap-2">
            {primary ? (
              <GoalCard
                key={primary.goalId}
                goal={primary}
                siteId={siteId}
                orderValue={orderMap[base]}
                onOrderChange={(val?: number) => setBaseOrder(base, val)}
                secondaryCount={sortedSecondaries.length}
                isGroupOpen={isOpen}
                onToggleSecondaries={() => setOpenGroups(prev => ({ ...prev, [base]: !prev[base] }))}
              />
            ) : null}

            {hasSecondaries && isOpen ? (
              <div className="mt-2 pl-6 md:pl-8 flex flex-col gap-3">
                {sortedSecondaries.map(g => (
                  <GoalCard key={g.goalId} goal={g} siteId={siteId} />
                ))}
              </div>
            ) : null}

            {!primary && !hasSecondaries ? null : null}
          </div>
        );
      })}
    </div>
  );
}
