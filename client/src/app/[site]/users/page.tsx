"use client";

import { DateTime } from "luxon";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useGetUsers } from "../../../api/analytics/users";
import { useGetSessionsInfinite } from "../../../api/analytics/userSessions";
import { Button } from "../../../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { USER_PAGE_FILTERS } from "../../../lib/store";
import { SubHeader } from "../components/SubHeader/SubHeader";
import { DisabledOverlay } from "../../../components/DisabledOverlay";
import { Avatar } from "../../../components/Avatar";
import { SessionDetails } from "../../../components/Sessions/SessionDetails";
import { Badge } from "../../../components/ui/badge";
import { formatter } from "../../../lib/utils";
import { FileText, MousePointerClick, Rewind, RefreshCw, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";


function CombinedRefresh({ isFetching, onRefresh }: { isFetching: boolean; onRefresh: () => void }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 5));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isFetching) {
      setCountdown(5);
    }
  }, [isFetching]);

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 px-2 w-full"
      onClick={() => {
        if (!isFetching) {
          onRefresh();
          setCountdown(5);
        }
      }}
      disabled={isFetching}
      title={`Auto refresh in ${countdown}s`}
    >
      {isFetching ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <RefreshCw className="w-3 h-3" />
      )}
      <span className="ml-1 text-xs">refresh in {countdown}s</span>
    </Button>
  );
}

export default function UsersPage() {
  useSetPageTitle("Rybbit · Users");

  const { site } = useParams();

  // Sidebar state: sorting and search
  const [sidebarSort, setSidebarSort] = useState<{ key: "last_seen" | "events" | "pageviews"; order: "asc" | "desc" }>({ key: "last_seen", order: "desc" });
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Server-side pagination kept minimal (first page) to populate sidebar list
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 50,
  });

  // Map sidebar sort to table/react-query sort state
  const sorting: SortingState = [{ id: sidebarSort.key, desc: sidebarSort.order === "desc" }];

  // Convert page index to 1-based for the API
  const page = pagination.pageIndex + 1;

  // Fetch data (users list for sidebar)
  const { data, isLoading, isError, refetch, /* dataUpdatedAt, */ isFetching } = useGetUsers({
    page,
    pageSize: pagination.pageSize,
    sortBy: sidebarSort.key,
    sortOrder: sidebarSort.order,
  });

  // Format relative time with special handling for times less than 1 minute
  const formatRelativeTime = (dateStr: string) => {
    const date = DateTime.fromSQL(dateStr, { zone: "utc" }).toLocal();
    const diff = Math.abs(date.diffNow(["minutes"]).minutes);

    if (diff < 1) {
      return "<1 min ago";
    }

    return date.toRelative();
  };

  // Client-side filter list by user_id search
  const users = (data?.data || []).filter(u => (search ? u.user_id.toLowerCase().includes(search.toLowerCase()) : true));


  if (isError) {
    return <div className="p-8 text-center text-red-500">An error occurred while fetching users data.</div>;
  }

  return (
    <DisabledOverlay message="Users" featurePath="users">
      <div className="p-2 md:p-4 max-w-[1600px] mx-auto space-y-3">
        <SubHeader availableFilters={USER_PAGE_FILTERS} />

        <div className="rounded-md border border-neutral-800 bg-neutral-900">
          {/* Split layout: 10% sidebar, 90% content */}
          <div className="flex">
            {/* Sidebar 10% */}
            <div className="basis-[10%] min-w-[180px] max-w-[260px] border-r border-neutral-800 p-2 flex flex-col gap-2 h-dvh overflow-y-auto">
                <Badge variant="outline" className="h-6 px-2 bg-neutral-800 text-neutral-100 w-full">
                    {users.length.toLocaleString()} users
                </Badge>
                <div className="w-full">
                    <CombinedRefresh isFetching={isFetching} onRefresh={refetch} />
                </div>
              {/* Sort controls */}
              <div className="flex items-center gap-2">

                <Select
                  value={sidebarSort.key}
                  onValueChange={(val) =>
                    setSidebarSort(() => ({ key: val as typeof sidebarSort.key, order: "desc" }))
                  }
                >
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder="Select sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_seen">last seen</SelectItem>
                    <SelectItem value="events">events</SelectItem>
                    <SelectItem value="pageviews">pageviews</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search by user_id */}
              {/*<div>*/}
              {/*  <input*/}
              {/*    type="text"*/}
              {/*    placeholder="Search user_id"*/}
              {/*    value={search}*/}
              {/*    onChange={e => setSearch(e.target.value)}*/}
              {/*    className="w-full px-2 py-1 rounded border border-neutral-800 bg-neutral-850 text-sm outline-none focus:ring-1 focus:ring-neutral-600"*/}
              {/*  />*/}
              {/*</div>*/}



              {/* Users list */}
              <div className="flex-1 pr-1">
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="h-10 rounded bg-neutral-850 animate-pulse" />
                    ))}
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-xs text-neutral-500 p-2">No users</div>
                ) : (
                  <ul className="space-y-1">
                    {users.map(u => (
                      <li key={u.user_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(u.user_id)}
                          className={`w-full text-left px-2 py-2 rounded border transition-colors ${
                            selectedUserId === u.user_id
                              ? "bg-neutral-800 border-neutral-700"
                              : "bg-neutral-900 hover:bg-neutral-850 border-neutral-800"
                          }`}
                          title={u.user_id}
                        >
                          <div className="flex items-center gap-2">
                            <Avatar size={16} name={u.user_id} />
                            <span className="text-xs font-mono text-neutral-300 truncate">{u.user_id.slice(0, 12)}</span>
                          </div>
                          {u.ip ? (
                            <div className="mt-1 text-[10px] text-neutral-400 truncate" title={u.ip}>
                              {u.ip}
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-neutral-300">
                            <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">
                              <FileText className="w-3 h-3 text-blue-500" />
                              {formatter(u.pageviews)}
                            </Badge>
                            <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">
                              <MousePointerClick className="w-3 h-3 text-amber-500" />
                              {formatter(u.events)}
                            </Badge>
                            <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">
                              <Rewind className="w-3 h-3 text-green-500" />
                              {formatter(u.sessions)}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[10px] text-neutral-400 flex items-center gap-2">
                            {u.city ? <span title="City" className="truncate max-w-[8rem]">{u.city}</span> : null}
                            {u.device_type ? <span title="Device">{u.device_type}</span> : null}
                          </div>
                          <div className="mt-1 text-[10px] text-neutral-500">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>{formatRelativeTime(u.last_seen)}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <span>
                                    {DateTime.fromSQL(u.last_seen, { zone: "utc" }).toLocal().toLocaleString(DateTime.DATETIME_SHORT)}
                                  </span>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Pagination controls (simple) */}
                <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    Page {pagination.pageIndex + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pagination.pageIndex === 0 || isLoading}
                      onClick={() => setPagination(p => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))}
                    >
                      Prev
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading || (data?.data?.length || 0) < pagination.pageSize}
                      onClick={() => setPagination(p => ({ ...p, pageIndex: p.pageIndex + 1 }))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Content 90% */}
            <RightPane selectedUserId={selectedUserId} />
          </div>
        </div>
      </div>
    </DisabledOverlay>
  );
}

function RightPane({ selectedUserId }: { selectedUserId: string | null }) {
  // Lazy import hooks and components to keep file cohesion
  const { data, isLoading, error } = useGetSessionsInfinite(selectedUserId || undefined);

  const firstSession = data?.pages?.[0]?.data?.[0];

  if (!selectedUserId) {
    return (
      <div className="basis-[90%] p-3 min-h-[500px] flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Select a user from the left to view session details</div>
      </div>
    );
  }

  return (
    <div className="basis-[90%] h-dvh overflow-y-auto">
      {isLoading ? (
        <div className="p-4">
          <div className="h-6 w-40 bg-neutral-800 rounded mb-3 animate-pulse" />
          <div className="h-32 w-full bg-neutral-850 rounded animate-pulse" />
        </div>
      ) : error ? (
        <div className="p-4 text-red-400">Failed to load sessions.</div>
      ) : !firstSession ? (
        <div className="p-4 text-neutral-500">No sessions for this user.</div>
      ) : (
        <SessionDetails session={firstSession} userId={selectedUserId} />
      )}
    </div>
  );
}
