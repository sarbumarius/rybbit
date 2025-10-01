"use client";

import { FileText, MousePointerClick, Edit, Trash2, User as UserIcon, Fingerprint, Video, MoreVertical, List, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDeleteGoal } from "../../../../api/analytics/goals/useDeleteGoal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";
import { Button } from "../../../../components/ui/button";
import GoalFormModal from "./GoalFormModal";
import { UserActionsSheet } from "../../../../components/UserActions/UserActionsSheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../../../components/ui/tooltip";
import { Goal } from "../../../../api/analytics/goals/useGetGoals";
import Link from "next/link";
import { Badge } from "../../../../components/ui/badge";
import { useParams } from "next/navigation";

// Lightweight product info fetcher and inline renderer (mirrors SessionDetails behavior)
 type ProductApiResponse = {
  ok?: boolean;
  product_id?: number;
  slug?: string;
  nume?: string;
  pret?: number;
  pret_regular?: number;
  pret_redus?: number;
  vanzari?: number;
  comentarii?: number;
  poza?: string;
  excerpt?: string;
  status?: string;
};

const productCache = new Map<string, ProductApiResponse>();
const productPromiseCache = new Map<string, Promise<ProductApiResponse>>();

async function fetchProductInfoWithCache(slug: string): Promise<ProductApiResponse> {
  const key = slug.trim();
  if (!key) return {};
  const cached = productCache.get(key);
  if (cached) return cached;
  const inflight = productPromiseCache.get(key);
  if (inflight) return inflight;
  const promise = (async () => {
    const res = await fetch(`https://crm.actium.ro/api/identificare-produs/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ProductApiResponse = await res.json();
    if (data && data.ok) {
      productCache.set(key, data);
    }
    return data;
  })().finally(() => {
    productPromiseCache.delete(key);
  });
  productPromiseCache.set(key, promise);
  return promise;
}

function extractProductSlug(path?: string | null): string | null {
  if (!path) return null;
  const m = path.match(/\/produs\/([^\/?#]+)/);
  return m ? m[1] : null;
}

function ProductInfoInline({ pathname }: { pathname?: string | null }) {
  const slug = extractProductSlug(pathname || undefined);
  const [info, setInfo] = useState<ProductApiResponse | null>(null);
  useEffect(() => {
    let mounted = true;
    if (slug) {
      fetchProductInfoWithCache(slug)
        .then(d => {
          if (mounted) setInfo(d);
        })
        .catch(() => {
          /* ignore */
        });
    }
    return () => {
      mounted = false;
    };
  }, [slug]);

  if (!slug) return null;
  if (!info || !info.ok) return null;

  return (
    <div className="mt-1 inline-flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900 px-1.5 py-1">
      {info.poza ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info.poza}
          alt={info.nume || info.slug || slug}
          width={28}
          height={28}
          loading="lazy"
          className="rounded object-cover border border-neutral-800"
        />
      ) : null}
      <div className="min-w-0">
        <div className="text-[11px] text-neutral-200 font-medium truncate max-w-[200px]" title={info.nume || info.slug || slug}>
          {info.nume || info.slug || slug}
        </div>
        <div className="text-[10px] text-neutral-300 mt-0.5 flex items-center gap-2">
          {typeof info.pret_regular === "number" && info.pret_redus && info.pret_redus < info.pret_regular ? (
            <>
              <span className="line-through text-neutral-500">{info.pret_regular} RON</span>
              <span className="text-green-400 font-semibold">{info.pret_redus} RON</span>
            </>
          ) : (
            <span className="text-neutral-200 font-semibold">{info.pret ?? info.pret_redus ?? ""} {info.pret || info.pret_redus ? "RON" : ""}</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  siteId: number;
  // Optional: show order input next to actions for primary group
  orderValue?: number;
  onOrderChange?: (val?: number) => void;
  // Optional: secondary controls for primary group
  secondaryCount?: number;
  isGroupOpen?: boolean;
  onToggleSecondaries?: () => void;
}

export default function GoalCard({ goal, siteId, orderValue, onOrderChange, secondaryCount, isGroupOpen, onToggleSecondaries }: GoalCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [openEntries, setOpenEntries] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsUserId, setActionsUserId] = useState<string | null>(null);
  const deleteGoalMutation = useDeleteGoal();
  const { site } = useParams() as { site: string };

  const handleDelete = async () => {
    try {
      await deleteGoalMutation.mutateAsync(goal.goalId);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting goal:", error);
    }
  };

  const entries = useMemo(() => {
    if (goal.goalType === "path") {
      if (Array.isArray(goal.matched_conversions) && goal.matched_conversions.length > 0) {
        return goal.matched_conversions.map(mc => ({
          type: "page" as const,
          label: mc.pathname || "",
          session_id: mc.session_id,
          user_id: mc.user_id || undefined,
          matched_at: mc.matched_at || null,
        }));
      }
      if (Array.isArray(goal.matched_pages) && goal.matched_pages.length > 0) {
        // fallback without session/user/date
        return goal.matched_pages.map((p, idx) => ({
          type: "page" as const,
          label: p,
          session_id: undefined,
          user_id: undefined,
          matched_at: null,
          key: `page-${idx}-${p}`,
        }));
      }
      return [];
    } else {
      if (Array.isArray(goal.matched_actions_details) && goal.matched_actions_details.length > 0) {
        return goal.matched_actions_details.map(ma => ({
          type: "event" as const,
          label: ma.event_name || "",
          session_id: ma.session_id,
          user_id: ma.user_id || undefined,
          matched_at: ma.matched_at || null,
        }));
      }
      if (Array.isArray(goal.matched_actions) && goal.matched_actions.length > 0) {
        return goal.matched_actions.map((a, idx) => ({
          type: "event" as const,
          label: a,
          session_id: undefined,
          user_id: undefined,
          matched_at: null,
          key: `action-${idx}-${a}`,
        }));
      }
      return [];
    }
  }, [goal]);

  const count = entries.length || goal.total_conversions || 0;

  const formatDateTime = (s?: string | null) => {
    if (!s) return null;
    const d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString();
  };

  // Separate helpers for date and time (local timezone)
  const formatDate = (s?: string | null) => {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return s || "";
    return d.toLocaleDateString();
  };
  const formatTime = (s?: string | null) => {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return s || "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Compute hourly intensity (0-23) based on matched_at timestamps
  const hourCounts = useMemo(() => {
    const arr = Array.from({ length: 24 }, () => 0);
    entries.forEach(it => {
      if (!it.matched_at) return;
      const d = new Date((it.matched_at as string).replace(" ", "T") + "Z");
      if (!isNaN(d.getTime())) {
        arr[d.getHours()]++;
      }
    });
    return arr;
  }, [entries]);
  const maxHourCount = useMemo(() => hourCounts.reduce((m, v) => Math.max(m, v), 0), [hourCounts]);

  const isZeroMatches = (goal.total_conversions ?? 0) === 0;

  return (
    <>
      <div className={`rounded-lg overflow-hidden relative border ${isZeroMatches ? "bg-red-900/20 border-red-800" : "bg-neutral-900 border-neutral-800"}`}>
        <div className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center mb-1">
          {/* Left section - Title and type */}
          <div className="w-full md:flex-1 md:pr-4">
            <h3 className="font-medium text-base flex items-center gap-2">
              {goal.goalType === "path" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <FileText className="w-4 h-4 text-blue-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Page Goal</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <MousePointerClick className="w-4 h-4 text-amber-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Event Goal</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {goal.name || `Goal #${goal.goalId}`}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-400">Pattern:</span>
              <code className="text-xs bg-neutral-800 px-1 py-0.5 rounded break-all">
                {goal.goalType === "path" ? goal.config.pathPattern : goal.config.eventName}
              </code>
              {/* Secondary count and toggle inline next to pattern */}
              {typeof secondaryCount === "number" && secondaryCount > 0 && onToggleSecondaries ? (
                <button
                  type="button"
                  onClick={onToggleSecondaries}
                  className="ml-2 inline-flex items-center gap-1 text-[12px] text-neutral-300 hover:text-neutral-100"
                  title={isGroupOpen ? "Ascunde secundarele" : "Arată secundarele"}
                >
                  <span className="text-neutral-600">|</span>
                  {isGroupOpen ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span>{secondaryCount} goals secundare</span>
                </button>
              ) : null}

              {goal.goalType === "event" && goal.config.eventPropertyKey && (
                <div className="mt-1 text-xs text-neutral-400">
                  Property:{" "}
                  <code className="text-xs bg-neutral-800 px-1 py-0.5 rounded text-neutral-100">
                    {goal.config.eventPropertyKey}: {String(goal.config.eventPropertyValue)}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Center section - Stats */}
          <div className="w-full md:flex-1 md:flex md:justify-center">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="font-bold text-base">{goal.total_conversions.toLocaleString()}</div>
                <div className="text-xs text-neutral-400">Matches</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-base">{(goal.conversion_rate * 100).toFixed(2)}%</div>
                <div className="text-xs text-neutral-400">Match Rate</div>
              </div>
            </div>
          </div>

          {/* Right section - Actions */}
          <div className="w-full md:w-auto flex flex-wrap md:flex-nowrap items-center gap-1 md:pl-4 justify-end md:justify-start">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] inline-flex items-center gap-1"
              onClick={() => setOpenEntries(v => !v)}
              title={openEntries ? "Ascunde entries" : "Arată entries"}
            >
              {openEntries ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>{openEntries ? "Hide" : `View (${count})`}</span>
            </Button>

            {onOrderChange !== undefined ? (
              <div className="ml-1 flex items-center gap-1">
                <label className="sr-only">Ordine</label>
                <input
                  type="number"
                  min={1}
                  value={orderValue ?? ""}
                  placeholder="-"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) onOrderChange(undefined);
                    else {
                      const n = parseInt(val, 10);
                      if (isNaN(n) || n < 1) onOrderChange(undefined);
                      else onOrderChange(n);
                    }
                  }}
                  className="w-14 md:w-16 h-7 px-2 py-1 rounded border border-neutral-800 bg-neutral-900 text-neutral-200 text-[12px] focus:outline-none focus:ring-1 focus:ring-accent-500"
                  title="Ordine"
                />
              </div>
            ) : null}

            <GoalFormModal
              siteId={siteId}
              goal={goal}
              trigger={
                <Button variant="ghost" size="smIcon" title="Editează">
                  <Edit className="h-4 w-4" />
                </Button>
              }
            />
            <GoalFormModal
              siteId={siteId}
              initialGoal={goal}
              trigger={
                <Button variant="ghost" size="smIcon" title="Duplicate">
                  <Copy className="h-4 w-4" />
                </Button>
              }
            />
            <Button onClick={() => setIsDeleteDialogOpen(true)} variant="ghost" size="smIcon" title="Șterge">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="bg-neutral-700 h-1.5 w-full absolute bottom-0 left-0"></div>

        <div
          style={{
            width: goal.conversion_rate * 100 + "%",
          }}
          className="bg-accent-400/75 h-1.5 absolute bottom-0 left-0"
        ></div>
      </div>

      <div className="entries">
        {openEntries && (
          <div className="mt-2 border border-neutral-800 rounded-md overflow-hidden">
            {/* Hour intensity bar */}
            {/*<div className="px-2 py-2 border-b border-neutral-800 bg-neutral-950/40">*/}
            {/*  <div className="flex items-center justify-between mb-1">*/}
            {/*    <div className="text-[11px] text-neutral-400">Activity by hour</div>*/}
            {/*    <div className="text-[10px] text-neutral-500">{maxHourCount} max</div>*/}
            {/*  </div>*/}
            {/*  <div className="grid grid-cols-24 gap-[2px]">*/}
            {/*    {hourCounts.map((c, h) => {*/}
            {/*      const ratio = maxHourCount ? c / maxHourCount : 0;*/}
            {/*      const hue = Math.round(140 - 140 * ratio); // green -> red*/}
            {/*      const bg = ratio > 0 ? `hsl(${hue} 70% 40%)` : "rgba(120,120,120,0.2)";*/}
            {/*      const opacity = ratio > 0 ? 0.9 : 0.3;*/}
            {/*      return (*/}
            {/*        <div*/}
            {/*          key={h}*/}
            {/*          title={`${h.toString().padStart(2, "0")}:00 — ${c}`}*/}
            {/*          style={{ backgroundColor: bg, opacity }}*/}
            {/*          className="h-3 rounded-sm"*/}
            {/*        />*/}
            {/*      );*/}
            {/*    })}*/}
            {/*  </div>*/}
            {/*  <div className="flex justify-between text-[9px] text-neutral-500 mt-1">*/}
            {/*    <span>00</span>*/}
            {/*    <span>06</span>*/}
            {/*    <span>12</span>*/}
            {/*    <span>18</span>*/}
            {/*    <span>23</span>*/}
            {/*  </div>*/}
            {/*</div>*/}
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-neutral-400">
                  <tr className="border-b border-neutral-800">
                    {/*<th className="text-left py-1 px-2">Date</th>*/}
                    {/*<th className="text-left py-1 px-2">Type</th>*/}
                    <th className="text-left py-1 px-2">Label</th>
                    <th className="text-left py-1 px-2">Session</th>
                    <th className="text-left py-1 px-2">User</th>
                    <th className="text-left py-1 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  {entries.map((it, idx) => (
                    <tr key={it.session_id ? `${it.session_id}-${idx}` : (it as any).key || idx} className="border-b border-neutral-800">
                      {/*<td className="py-1 px-2 whitespace-nowrap text-neutral-400 grid grid-cols-1 text-center">*/}

                      {/*    {it.matched_at ? (*/}
                      {/*      <div className="leading-tight">*/}
                      {/*        <div className="text-neutral-200">{formatDate(it.matched_at)}</div>*/}
                      {/*        <div className="text-[10px] text-neutral-400">{formatTime(it.matched_at)}</div>*/}
                      {/*      </div>*/}
                      {/*    ) : (*/}
                      {/*      <span className="text-neutral-600">-</span>*/}
                      {/*    )}*/}
                      {/*</td>*/}
                      {/*<td className="py-1 px-2">*/}
                      {/*  <Badge variant="outline" className="px-1.5 py-0 h-5 bg-neutral-850 border-neutral-700 text-neutral-200 uppercase">*/}
                      {/*    {it.type}*/}
                      {/*  </Badge>*/}
                      {/*</td>*/}
                      <td className="py-1 px-2 font-mono break-all">
                                              {it.label}
                                              {it.type === "page" && typeof it.label === "string" && it.label.includes("/produs/") ? (
                                                <div>
                                                  <ProductInfoInline pathname={it.label} />
                                                </div>
                                              ) : null}
                                            </td>
                      <td className="py-1 px-2">
                        {it.session_id ? (
                          <Link href={`/${site}/replay?sessionId=${it.session_id}`} target="_blank" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800">
                            <Fingerprint className="w-3.5 h-3.5 text-neutral-300" />
                            <span className="font-mono truncate max-w-[160px]">{it.session_id}</span>
                          </Link>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                      <td className="py-1 px-2">
                        {it.user_id ? (
                          <Link href={`/${site}/user/${it.user_id}`} target="_blank" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800">
                            <UserIcon className="w-3.5 h-3.5 text-neutral-300" />
                            <span className="font-mono truncate max-w-[160px]">{it.user_id}</span>
                          </Link>
                        ) : (
                          <span className="text-neutral-600">-</span>
                        )}
                      </td>
                      <td className="py-1 px-2">
                        <div className="hidden md:flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {it.user_id ? (
                                  <Link
                                    href={`/${site}/replay?user=${it.user_id}`}
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
                                {it.user_id ? (
                                  <Link
                                    href={`/${site}/user/${it.user_id}`}
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
                                  if (!it.user_id) return;
                                  setActionsUserId(it.user_id!);
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked */}
            <div className="md:hidden divide-y divide-neutral-800">
              {entries.map((it, idx) => (
                <div key={it.session_id ? `${it.session_id}-m-${idx}` : (it as any).key || `m-${idx}`} className="p-2">
                  <div className="text-[10px] text-neutral-400">{formatDateTime(it.matched_at) || ""}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge variant="outline" className="px-1.5 py-0 h-5 bg-neutral-850 border-neutral-700 text-neutral-200 uppercase">{it.type}</Badge>
                    <div className="font-mono text-[11px] break-all text-neutral-200">{it.label}</div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    {it.session_id ? (
                      <Link href={`/${site}/replay?sessionId=${it.session_id}`} target="_blank" className="inline-flex items-center gap-1 px-1 py-0.5 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800">
                        <Fingerprint className="w-3 h-3 text-neutral-300" />
                        <span className="font-mono">{it.session_id.slice(0, 10)}...</span>
                      </Link>
                    ) : null}
                    {it.user_id ? (
                      <Link href={`/${site}/user/${it.user_id}`} target="_blank" className="inline-flex items-center gap-1 px-1 py-0.5 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800">
                        <UserIcon className="w-3 h-3 text-neutral-300" />
                        <span className="font-mono">{it.user_id.slice(0, 10)}...</span>
                      </Link>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    {it.user_id ? (
                      <Link
                        href={`/${site}/replay?user=${it.user_id}`}
                        target="_blank"
                        className="p-1 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800 inline-flex"
                        title="View video"
                      >
                        <Video className="w-3.5 h-3.5 text-blue-400" />
                      </Link>
                    ) : (
                      <span className="p-1 rounded border border-neutral-900 text-neutral-600 inline-flex">
                        <Video className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {it.user_id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setActionsUserId(it.user_id!);
                          setActionsOpen(true);
                        }}
                        className="p-1 rounded border border-neutral-800 bg-neutral-850 hover:bg-neutral-800 inline-flex"
                        title="View actions"
                      >
                        <List className="w-3.5 h-3.5 text-amber-400" />
                      </button>
                    ) : (
                      <span className="p-1 rounded border border-neutral-900 text-neutral-600 inline-flex">
                        <List className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the goal and remove it from all reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant="destructive">
              {deleteGoalMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UserActionsSheet
        userId={actionsUserId}
        open={actionsOpen}
        onOpenChange={(open) => {
          setActionsOpen(open);
          if (!open) setActionsUserId(null);
        }}
      />
    </>
  );
}
