"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useGetSessionsInfinite, GetSessionsResponse } from "../../api/analytics/userSessions";
import { Badge } from "../ui/badge";
import { FileText, MousePointerClick, TriangleAlert } from "lucide-react";
import { SessionDetails } from "../Sessions/SessionDetails";

interface UserActionsSheetProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserActionsSheet({ userId, open, onOpenChange }: UserActionsSheetProps) {
  const enabled = open && !!userId;
  const { data, isLoading, error } = useGetSessionsInfinite(enabled ? userId || undefined : undefined);

  // Flatten and sort sessions (newest first)
  const sessions: GetSessionsResponse = useMemo(() => {
    const arr = data?.pages?.flatMap(p => p.data || []) || [];
    return arr.sort((a, b) => new Date(b.session_start).getTime() - new Date(a.session_start).getTime());
  }, [data]);

  // Default selected tab to the most recent session
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (open) {
      const first = sessions[0]?.session_id;
      setActiveId(prev => prev || first);
    } else {
      setActiveId(undefined);
    }
  }, [open, sessions]);

  const activeSession = useMemo(() => sessions.find(s => s.session_id === activeId), [sessions, activeId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" withOverlay={false} className="w-[min(95vw,980px)] p-0">
        <SheetHeader className="px-3 py-2 border-b border-neutral-800 bg-neutral-900 text-left">
          <SheetTitle className="text-sm text-neutral-200">
            {userId ? (
              <span className="font-mono">User: {userId}</span>
            ) : (
              <span className="text-neutral-400">No user selected</span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="h-[calc(100vh-44px)] flex flex-col">
          {error ? (
            <div className="p-3 text-red-500 text-sm">Failed to load sessions.</div>
          ) : isLoading ? (
            <div className="p-3 text-neutral-400 text-sm">Loading sessions…</div>
          ) : sessions.length === 0 ? (
            <div className="p-3 text-neutral-400 text-sm">No sessions for this user in the selected range.</div>
          ) : (
            <Tabs value={activeId} onValueChange={setActiveId} className="flex-1 min-h-0 flex flex-col">
              <div className="border-b border-r border-neutral-800 bg-neutral-900/80 sticky top-0 z-10">
                <TabsList className="flex items-center gap-2 overflow-x-auto max-w-full ">
                  {sessions.map(s => (
                    <TabsTrigger key={s.session_id} value={s.session_id} className="px-2 py-1 text-[11px]">
                      <span className="font-mono">{s.session_id.slice(0, 10)}</span>
                      {/*<span className="ml-2 inline-flex items-center gap-1 text-neutral-300">*/}
                      {/*  <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">*/}
                      {/*    <FileText className="w-3 h-3 text-blue-500" /> {s.pageviews}*/}
                      {/*  </Badge>*/}
                      {/*  <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">*/}
                      {/*    <MousePointerClick className="w-3 h-3 text-amber-500" /> {s.events}*/}
                      {/*  </Badge>*/}
                      {/*  <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">*/}
                      {/*    <TriangleAlert className="w-3 h-3 text-red-500" /> {s.errors ?? 0}*/}
                      {/*  </Badge>*/}
                      {/*</span>*/}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {sessions.map(s => (
                <TabsContent key={s.session_id} value={s.session_id} className="flex-1 min-h-0">
                  {/* Full session actions list */}
                  <div className="h-[calc(100vh-88px)] overflow-y-auto">
                    <SessionDetails session={s} userId={userId || undefined} />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
