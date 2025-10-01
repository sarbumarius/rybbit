"use client";

import { DateSelector } from "@/components/DateSelector/DateSelector";
import { Time } from "@/components/DateSelector/types";
import { round } from "lodash";
import { FunnelResponse } from "../../../../api/analytics/funnels/useGetFunnel";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { User as UserIcon, Video, MoreVertical, List } from "lucide-react";
import { UserActionsSheet } from "@/components/UserActions/UserActionsSheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type FunnelChartData = {
  stepName: string;
  visitors: number;
  conversionRate: number;
  dropoffRate: number;
  stepNumber: number;
};

interface FunnelProps {
  data?: FunnelResponse[] | undefined;
  isError: boolean;
  error: unknown;
  isPending: boolean;
  time: Time;
  setTime: (time: Time) => void;
  layoutMode?: "stack" | "grid"; // default stack
  autoOpenEntries?: boolean; // default false
}

export function Funnel({ data, isError, error, isPending, time, setTime, layoutMode = "stack", autoOpenEntries = false }: FunnelProps) {
  const { site } = useParams() as { site: string };
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const [actionsOpen, setActionsOpen] = useState<boolean>(false);
  const [actionsUserId, setActionsUserId] = useState<string | null>(null);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  // Auto-open entries for all steps when requested
  // This runs when data changes or the flag toggles
  useEffect(() => {
    if (!autoOpenEntries || !data || data.length === 0) return;
    const allOpen: Record<number, boolean> = {};
    data.forEach((_, idx) => {
      allOpen[idx] = true;
    });
    setOpenSteps(allOpen);
  }, [autoOpenEntries, data]);
  
  const isGrid = layoutMode === "grid";
  
  // Prepare chart data
  const chartData =
    data?.map(step => ({
      stepName: step.step_name,
      visitors: step.visitors,
      conversionRate: step.conversion_rate,
      dropoffRate: step.dropoff_rate,
      stepNumber: step.step_number,
    })) || [];

  // Build per-step user sets and progressive intersections (continuous flow up to each step)
  const userSetsPerStep = useMemo(() => {
    if (!data) return [] as Array<Set<string>>;
    return data.map(step => {
      const entries = step.details?.entries || [];
      const ids = entries.map(e => e.user_id).filter((u): u is string => Boolean(u));
      return new Set(ids);
    });
  }, [data]);

  // Users that appear in all steps (global intersection)
  const globalIntersection = useMemo(() => {
    if (!userSetsPerStep.length) return new Set<string>();
    let inter = new Set<string>(userSetsPerStep[0]);
    for (let i = 1; i < userSetsPerStep.length; i++) {
      const next = userSetsPerStep[i];
      const tmp = new Set<string>();
      inter.forEach(u => {
        if (next.has(u)) tmp.add(u);
      });
      inter = tmp;
    }
    return inter;
  }, [userSetsPerStep]);

  // Users present in all steps up to each step (prefix intersection)
  const prefixIntersections = useMemo(() => {
    const result: Array<Set<string>> = [];
    if (!userSetsPerStep.length) return result;
    let inter = new Set<string>(userSetsPerStep[0]);
    result[0] = new Set(inter);
    for (let i = 1; i < userSetsPerStep.length; i++) {
      const next = userSetsPerStep[i];
      const tmp = new Set<string>();
      inter.forEach(u => {
        if (next.has(u)) tmp.add(u);
      });
      inter = tmp;
      result[i] = new Set(inter);
    }
    return result;
  }, [userSetsPerStep]);

  // Map user_id to the set of step indices where they appear
  const userStepsMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!data) return map;
    data.forEach((step, idx) => {
      const entries = step.details?.entries || [];
      entries.forEach(e => {
        if (!e.user_id) return;
        if (!map.has(e.user_id)) map.set(e.user_id, new Set<number>());
        map.get(e.user_id)!.add(idx);
      });
    });
    return map;
  }, [data]);

  // Get first and last data points for total conversion metrics
  const firstStep = chartData[0];
  const lastStep = chartData[chartData.length - 1];
  const totalConversionRate = lastStep?.conversionRate || 0;

  const maxBarWidth = 100; // as percentage

  return (
    <div>
      <div className="flex items-center gap-4 mt-3 text-xs text-neutral-400 absolute top-0 left-1/2">
        <DateSelector time={time} setTime={setTime} pastMinutesEnabled={false} />
      </div>

      {isError ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="text-red-500">
            Error: {error instanceof Error ? error.message : "Failed to analyze funnel"}
          </div>
        </div>
      ) : data && chartData.length > 0 ? (
        <div className={`${isGrid ? "grid gap-6 md:grid-cols-2 xl:grid-cols-3" : "space-y-0"}`}>
          {chartData.map((step, index) => {
            // Calculate the percentage width for the bar
            const ratio = firstStep?.visitors ? step.visitors / firstStep.visitors : 0;
            const barWidth = Math.max(ratio * maxBarWidth, 0);

            // For step 2+, calculate the number of users who dropped off
            const prevStep = index > 0 ? chartData[index - 1] : null;
            const droppedUsers = prevStep ? prevStep.visitors - step.visitors : 0;
            const dropoffPercent = prevStep ? (droppedUsers / prevStep.visitors) * 100 : 0;

            return (
              <div key={step.stepNumber} className={`${isGrid ? "relative p-4 border border-neutral-800 rounded-lg bg-neutral-900" : "relative pb-6"}`}>
                {/* Step number indicator */}
                <div className="flex items-center mb-2">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-xs mr-2">
                    {step.stepNumber}
                  </div>
                  <div className="font-medium text-base">{step.stepName}</div>
                </div>

                {/* Bar and metrics */}
                <div className={`flex items-center ${isGrid ? "" : "pl-8"}`}>
                  {/* Metrics */}
                  <div className="flex-shrink-0 min-w-[130px] mr-4">
                    <div className="flex items-baseline">
                      <span className="text-lg font-semibold">{step.visitors.toLocaleString()}</span>
                      <span className="text-sm text-neutral-400 ml-1">users</span>
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="flex-grow h-10 bg-neutral-800 rounded-md overflow-hidden relative">
                    {/* Relative conversion bar (from previous step) */}
                    {index > 0 && prevStep && (
                      <div
                        className="absolute h-full rounded-md"
                        style={{
                          width: `${(step.visitors / prevStep.visitors) * 100}%`,
                          background: `repeating-linear-gradient(
                              45deg,
                              rgba(16, 185, 129, 0.25),
                              rgba(16, 185, 129, 0.25) 6px,
                              rgba(16, 185, 129, 0.15) 6px,
                              rgba(16, 185, 129, 0.15) 12px
                            )`,
                        }}
                      ></div>
                    )}
                    {/* Absolute conversion bar (from first step) */}
                    <div
                      className="h-full bg-emerald-500/70 rounded-md relative z-10"
                      style={{ width: `${barWidth}%` }}
                    ></div>
                    <div className="absolute top-2 right-2 z-20">
                      <div className="text-base font-semibold">{round(step.conversionRate, 2)}%</div>
                    </div>
                  </div>
                </div>

                {/* Dropoff indicator */}
                {!isGrid && index < chartData.length - 1 && (
                  <div className="absolute left-[11px] -bottom-6 top-6 flex flex-col items-center">
                    <div className="h-full w-0.5 bg-neutral-800"></div>
                  </div>
                )}

                {/* Dropoff metrics */}
                {!isGrid && index !== 0 && (
                  <div className="pl-8 flex">
                    <div className="min-w-[180px] mr-4">
                      <div className="flex items-baseline text-orange-500">
                        <span className="text-sm font-medium">{droppedUsers.toLocaleString()} dropped</span>
                        {/* <span className="text-sm text-neutral-400 ml-1">
                            ({dropoffPercent.toFixed(2)}%)
                          </span> */}
                      </div>
                    </div>
                  </div>
                )}

                {/* Identified pages/actions for this step */}
                {/*{data && (data[index]?.details?.items?.length || 0) > 0 && (*/}
                {/*  <div className="pl-8 mt-2">*/}
                {/*    <div className="text-[11px] text-neutral-400 mb-1">Identified for this step</div>*/}
                {/*    <div className="flex flex-wrap gap-2">*/}
                {/*      {data[index]!.details!.items.map(it => (*/}
                {/*        <Badge key={it.label} variant="outline" className="px-1.5 py-0 h-6 bg-neutral-850 border-neutral-800 text-neutral-200">*/}
                {/*          <span className="font-mono text-[11px]">{it.label}</span>*/}
                {/*          <span className="ml-2 text-[10px] text-neutral-400">{it.users.toLocaleString()} users</span>*/}
                {/*        </Badge>*/}
                {/*      ))}*/}
                {/*    </div>*/}
                {/*  </div>*/}
                {/*)}*/}
                {/* Entries for this step */}
                {data && (data[index]?.details?.entries?.length || 0) > 0 && (
                  <div className={`${isGrid ? "mt-3" : "pl-8 mt-2"}`}>
                    <div className="flex items-center justify-between border ps-3 rounded-full border-neutral-800">
                      {(() => {
                        const stepType = data[index]?.details?.type as "page" | "event" | undefined;
                        const label = stepType === "page" ? "Entries pages" : stepType === "event" ? "Entries actions" : "Entries";
                        const entriesAll = data[index]?.details?.entries || [];
                        const normalizeType = (t: string) => (t === "pageview" ? "page" : t === "custom_event" ? "event" : t);
                        const entriesFiltered = stepType ? entriesAll.filter(e => normalizeType(e.type) === stepType) : entriesAll;
                        return (
                          <>
                            <div className="text-[11px] text-neutral-400">{label}</div>
                            <button
                              type="button"
                              onClick={() => setOpenSteps(s => ({ ...s, [index]: !s[index] }))}
                              className="text-[11px] px-2 py-1 rounded-full border border-neutral-800 bg-neutral-850 hover:bg-neutral-800 text-neutral-200"
                            >
                              {openSteps[index] ? "Hide entries" : `View entries (${entriesFiltered.length})`}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                    {openSteps[index] && (() => {
                      const stepType = data[index]?.details?.type as "page" | "event" | undefined;
                      const entriesAll = data[index]?.details?.entries || [];
                      const normalizeType = (t: string) => (t === "pageview" ? "page" : t === "custom_event" ? "event" : t);
                      const entriesForType = stepType ? entriesAll.filter(e => normalizeType(e.type) === stepType) : entriesAll;
                      const entriesSorted = entriesForType
                        .slice()
                        .sort((a, b) => {
                          const aGreen = !!(a.user_id && globalIntersection.has(a.user_id));
                          const bGreen = !!(b.user_id && globalIntersection.has(b.user_id));
                          const aOnlyFirst = !!(a.user_id && userStepsMap.get(a.user_id)?.size === 1 && userStepsMap.get(a.user_id)!.has(0));
                          const bOnlyFirst = !!(b.user_id && userStepsMap.get(b.user_id)?.size === 1 && userStepsMap.get(b.user_id)!.has(0));
                          const aYellow = !!(a.user_id && prefixIntersections[index]?.has(a.user_id) && !globalIntersection.has(a.user_id) && !(index === 0 && aOnlyFirst));
                          const bYellow = !!(b.user_id && prefixIntersections[index]?.has(b.user_id) && !globalIntersection.has(b.user_id) && !(index === 0 && bOnlyFirst));
                          if (isGrid) {
                            // View Funnel (grid): neutral first, then yellow, then green
                            if (aGreen !== bGreen) return aGreen ? 1 : -1; // green last
                            if (aYellow !== bYellow) return aYellow ? 1 : -1; // yellow after neutral
                            return 0;
                          } else {
                            // Default everywhere else: green first, then yellow, then neutral
                            if (aGreen !== bGreen) return aGreen ? -1 : 1;
                            if (aYellow !== bYellow) return aYellow ? -1 : 1;
                            return 0;
                          }
                        });

                      return (
                        <>
                          {/* Desktop/tablet table */}
                          <div className="mt-2 overflow-x-auto hidden md:block overflow-y-auto">
                            <table className="w-full text-[11px]">
                              <thead className="text-neutral-400">
                                <tr className="border-b border-neutral-800">
                                  <th className="text-left py-1 pr-2">Actions</th>

                                  <th className="text-left py-1 pr-2">Type</th>
                                  <th className="text-left py-1 pr-2">Label</th>
                                  {/*<th className="text-left py-1 pr-2">Session</th>*/}
                                  <th className="text-left py-1 pr-2">User</th>
                                </tr>
                              </thead>
                              <tbody className="text-neutral-300">
                                {entriesSorted.map((en, i) => {
                                  const isGreen = !!(en.user_id && globalIntersection.has(en.user_id));
                                  const stepsForUser = en.user_id ? userStepsMap.get(en.user_id) : undefined;
                                  const onlyInFirst = !!(stepsForUser && stepsForUser.size === 1 && stepsForUser.has(0));
                                  const isYellow = !!(en.user_id && prefixIntersections[index]?.has(en.user_id) && !globalIntersection.has(en.user_id) && !(index === 0 && onlyInFirst));
                                  const entryKey = `${en.user_id || 'anon'}|${en.session_id || 'nosess'}|${en.label}|${en.type}`;
                                  const isSelected = selectedEntryKey === entryKey;
                                  return (
                                    <tr key={`${en.session_id ?? i}-${i}`} className={`${isSelected ? "bg-emerald-900/30 border-b border-emerald-500" : "border-b border-neutral-800"} ${isGreen ? "bg-emerald-900/20" : isYellow ? "bg-amber-900/20" : ""}`}>
                                      <td className="py-1 pr-2">
                                        {/* Desktop actions: icon buttons with tooltips */}
                                        <div className="hidden md:flex items-center gap-1.5">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span>
                                                {en.user_id ? (
                                                  <Link
                                                    href={`/${site}/replay?user=${en.user_id}`}
                                                    target="_blank"
                                                    className="p-1 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 inline-flex"
                                                    title="View video"
                                                  >
                                                    <Video className="w-3.5 h-3.5 text-blue-400" />
                                                  </Link>
                                                ) : (
                                                  <span className="p-1 rounded border border-neutral-900 text-neutral-600 cursor-not-allowed inline-flex">
                                                    <Video className="w-3.5 h-3.5" />
                                                  </span>
                                                )}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>View video</TooltipContent>
                                          </Tooltip>

                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span>
                                                {en.user_id ? (
                                                  <Link
                                                    href={`/${site}/user/${en.user_id}`}
                                                    target="_blank"
                                                    className="p-1 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 inline-flex"
                                                    title="Go to user"
                                                  >
                                                    <UserIcon className="w-3.5 h-3.5 text-neutral-300" />
                                                  </Link>
                                                ) : (
                                                  <span className="p-1 rounded border border-neutral-900 text-neutral-600 cursor-not-allowed inline-flex">
                                                    <UserIcon className="w-3.5 h-3.5" />
                                                  </span>
                                                )}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>Go to user</TooltipContent>
                                          </Tooltip>

                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!en.user_id) return;
                                                  setActionsUserId(en.user_id!);
                                                  setSelectedEntryKey(entryKey);
                                                  setActionsOpen(true);
                                                }}
                                                className="p-1 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800 text-neutral-200 inline-flex"
                                                title="View actions"
                                              >
                                                <List className="w-3.5 h-3.5 text-amber-400" />
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent>View actions</TooltipContent>
                                          </Tooltip>
                                        </div>

                                        {/* Mobile actions: dropdown */}
                                        <div className="md:hidden">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="outline" size="sm" className="h-6 px-2">
                                                <MoreVertical className="w-4 h-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-[180px]">
                                              {en.user_id ? (
                                                <Link href={`/${site}/replay?user=${en.user_id}`} target="_blank">
                                                  <DropdownMenuItem className="flex items-center gap-2">
                                                    <Video className="w-4 h-4 text-blue-400" />
                                                    <span>View video</span>
                                                  </DropdownMenuItem>
                                                </Link>
                                              ) : (
                                                <DropdownMenuItem disabled className="flex items-center gap-2">
                                                  <Video className="w-4 h-4" />
                                                  <span>View video</span>
                                                </DropdownMenuItem>
                                              )}

                                              {en.user_id ? (
                                                <Link href={`/${site}/user/${en.user_id}`} target="_blank">
                                                  <DropdownMenuItem className="flex items-center gap-2">
                                                    <UserIcon className="w-4 h-4" />
                                                    <span>Go to user</span>
                                                  </DropdownMenuItem>
                                                </Link>
                                              ) : (
                                                <DropdownMenuItem disabled className="flex items-center gap-2">
                                                  <UserIcon className="w-4 h-4" />
                                                  <span>Go to user</span>
                                                </DropdownMenuItem>
                                              )}

                                              <DropdownMenuItem
                                                className="flex items-center gap-2"
                                                onClick={() => {
                                                  if (!en.user_id) return;
                                                  setActionsUserId(en.user_id!);
                                                  setSelectedEntryKey(entryKey);
                                                  setActionsOpen(true);
                                                }}
                                              >
                                                <List className="w-4 h-4 text-amber-400" />
                                                <span>View actions</span>
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </td>

                                      <td className="py-1 pr-2">
                                        <Badge variant="outline" className="px-1.5 py-0 h-5 bg-neutral-850 border-neutral-700 text-neutral-200 uppercase">
                                          {en.type === 'pageview' ? 'page' : en.type === 'custom_event' ? 'event' : en.type}
                                        </Badge>
                                      </td>
                                      <td className="py-1 pr-2 font-mono">{en.label}</td>
                                      {/*<td className="py-1 pr-2">*/}
                                      {/*  {en.session_id ? (*/}
                                      {/*    <span className="font-mono break-all">{en.session_id}</span>*/}
                                      {/*  ) : (*/}
                                      {/*    <span className="text-neutral-500">no session</span>*/}
                                      {/*  )}*/}
                                      {/*</td>*/}
                                      <td className="py-1 pr-2">
                                        {en.user_id ? (
                                          <div className="flex items-center gap-1">
                                            <UserIcon className="w-3.5 h-3.5 text-neutral-400" />
                                            <span className={`userPerson font-mono break-all ${isGreen ? "text-emerald-400" : isYellow ? "text-amber-400" : ""}`}>{en.user_id}</span>
                                          </div>
                                        ) : (
                                          <span className="text-neutral-500">anonymous</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile stacked cards */}
                          <div className="md:hidden mt-2 space-y-2">
                            {entriesSorted.map((en, i) => {
                              const isGreen = !!(en.user_id && globalIntersection.has(en.user_id));
                              const stepsForUser = en.user_id ? userStepsMap.get(en.user_id) : undefined;
                              const onlyInFirst = !!(stepsForUser && stepsForUser.size === 1 && stepsForUser.has(0));
                              const isYellow = !!(en.user_id && prefixIntersections[index]?.has(en.user_id) && !globalIntersection.has(en.user_id) && !(index === 0 && onlyInFirst));
                              const entryKey = `${en.user_id || 'anon'}|${en.session_id || 'nosess'}|${en.label}|${en.type}`;
                              const isSelected = selectedEntryKey === entryKey;
                              return (
                                <div key={`${en.session_id ?? i}-card-${i}`} className={`rounded-md border ${isSelected ? 'border-emerald-500 bg-emerald-900/20' : 'border-neutral-800 bg-neutral-900' } p-2`}>
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="px-1.5 py-0 h-5 bg-neutral-850 border-neutral-700 text-neutral-200 uppercase">{en.type}</Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-6 px-2">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="min-w-[180px]">
                                        {en.user_id ? (
                                          <Link href={`/${site}/replay?user=${en.user_id}`} target="_blank">
                                            <DropdownMenuItem className="flex items-center gap-2">
                                              <Video className="w-4 h-4 text-blue-400" />
                                              <span>View video</span>
                                            </DropdownMenuItem>
                                          </Link>
                                        ) : (
                                          <DropdownMenuItem disabled className="flex items-center gap-2">
                                            <Video className="w-4 h-4" />
                                            <span>View video</span>
                                          </DropdownMenuItem>
                                        )}
                                        {en.user_id ? (
                                          <Link href={`/${site}/user/${en.user_id}`} target="_blank">
                                            <DropdownMenuItem className="flex items-center gap-2">
                                              <UserIcon className="w-4 h-4" />
                                              <span>Go to user</span>
                                            </DropdownMenuItem>
                                          </Link>
                                        ) : (
                                          <DropdownMenuItem disabled className="flex items-center gap-2">
                                            <UserIcon className="w-4 h-4" />
                                            <span>Go to user</span>
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          className="flex items-center gap-2"
                                          onClick={() => {
                                            if (!en.user_id) return;
                                            setActionsUserId(en.user_id!);
                                            setSelectedEntryKey(entryKey);
                                            setActionsOpen(true);
                                          }}
                                        >
                                          <List className="w-4 h-4 text-amber-400" />
                                          <span>View actions</span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="mt-2 text-[11px] space-y-1">
                                    <div className="font-mono break-all text-neutral-200">{en.label}</div>
                                    <div className="text-neutral-400">
                                      <span className="text-neutral-500">Session: </span>
                                      {en.session_id ? <span className="font-mono break-all">{en.session_id}</span> : <span className="text-neutral-500">no session</span>}
                                    </div>
                                    <div className="text-neutral-400 flex items-center gap-1">
                                      <span className="text-neutral-500">User: </span>
                                      {en.user_id ? (
                                        <>
                                          <UserIcon className="w-3.5 h-3.5 text-neutral-400" />
                                          <span className={`font-mono break-all ${isGreen ? 'text-emerald-400' : isYellow ? 'text-amber-400' : ''}`}>{en.user_id}</span>
                                        </>
                                      ) : (
                                        <span className="text-neutral-500">anonymous</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-[400px] flex items-center justify-center">
          <div className="text-neutral-400 text-sm">
            {isPending ? "Analyzing funnel..." : "Configure your funnel steps and click 'Analyze Funnel'"}
          </div>
        </div>
      )}
      <UserActionsSheet
        userId={actionsUserId}
        open={actionsOpen}
        onOpenChange={(open) => {
          setActionsOpen(open);
          if (!open) {
            setActionsUserId(null);
            setSelectedEntryKey(null);
          }
        }}
      />
    </div>
  );
}
