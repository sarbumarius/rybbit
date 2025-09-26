import { useEffect, useMemo, useRef, useState } from "react";
import { GetSessionsResponse, useGetSessionsInfinite } from "../../api/analytics/userSessions";
import { SessionCardV2, SessionCardV2Skeleton } from "./SessionCardV2";
import { Button } from "../ui/button";
import { NothingFound } from "../NothingFound";
import { Rewind } from "lucide-react";
import { SessionDetails } from "./SessionDetails";
import { Input } from "../ui/input";

export default function SessionsList({ userId }: { userId?: string }) {
  // Get sessions data with infinite loading
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useGetSessionsInfinite(userId);

  // Combine all pages of data
  const flattenedData = useMemo(() => {
    if (!data) return [] as GetSessionsResponse;
    return data.pages.flatMap(page => page.data || []);
  }, [data]);

  // Local search for actions and pages (applies to details view)
  const [sessionSearch, setSessionSearch] = useState("");

  // Selection state: default to latest session when data arrives
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (flattenedData.length === 0) {
      setSelectedId(null);
      return;
    }
    // If nothing selected or current selection no longer exists, select most recent (first item)
    if (!selectedId || !flattenedData.some(s => s.session_id === selectedId)) {
      setSelectedId(flattenedData[0].session_id);
    }
  }, [flattenedData, selectedId]);

  // Find selected session object
  const selectedSession = useMemo(() => {
    return flattenedData.find(s => s.session_id === selectedId) || null;
  }, [flattenedData, selectedId]);

  // Reference for the scroll container (left list)
  const listRef = useRef<HTMLDivElement>(null);

  if (error) return <div className="text-red-500 p-4">Error: {(error as Error).message}</div>;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(180px,10%)_1fr] gap-3">
        <div className="space-y-2 max-h-[93vh] overflow-auto" ref={listRef}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SessionCardV2Skeleton key={i} />
          ))}
        </div>
        <div className="hidden lg:block max-h-[93vh] overflow-auto border border-neutral-800 rounded-md bg-neutral-900 p-4 text-neutral-400">
          Loading session details...
        </div>
      </div>
    );
  }

  if (flattenedData.length === 0) {
    return (
      <NothingFound
        icon={<Rewind className="w-10 h-10" />}
        title={"No sessions found"}
        description={"Try a different date range or filter"}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(180px,10%)_1fr] gap-3 items-start">
      {/* Left 10% list */}
      <div className="space-y-2 max-h-[93vh] overflow-auto pr-1" ref={listRef}>
        {/* Search input above session cards */}
        <div className="sticky top-0 z-10 bg-neutral-900 pt-1 pb-2 pr-1">
          <Input
            inputSize="sm"
            value={sessionSearch}
            onChange={e => setSessionSearch(e.target.value)}
            placeholder="Search actions and pages..."
            className="h-8 w-full"
          />
        </div>

        {flattenedData.map((session, index) => (
          <SessionCardV2
            key={`${session.session_id}-${index}`}
            session={session}
            selected={session.session_id === selectedId}
            onSelect={() => setSelectedId(session.session_id)}
          />
        ))}

        {isFetchingNextPage && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <SessionCardV2Skeleton key={`loading-more-${i}`} />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="pt-2">
            <Button onClick={() => fetchNextPage()} className="w-full" variant="success">
              Load more
            </Button>
          </div>
        )}
      </div>

      {/* Right 90% details */}
      <div className="max-h-[93vh] overflow-auto">
        {selectedSession ? (
          <div className="rounded-lg border border-neutral-800 overflow-hidden bg-neutral-900">
            <SessionDetails session={selectedSession} userId={userId} searchQuery={sessionSearch} />
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-400">
            Select a session to view details
          </div>
        )}
      </div>
    </div>
  );
}
