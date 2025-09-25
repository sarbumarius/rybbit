import { useEffect, useMemo, useRef } from "react";
import { useGetSessionsInfinite, GetSessionsResponse } from "../../api/analytics/userSessions";
import { SessionCard, SessionCardSkeleton } from "./SessionCard";
import { Button } from "../ui/button";
import { NothingFound } from "../NothingFound";
import { Rewind } from "lucide-react";

export default function SessionsList({ userId, initiallyExpanded = false }: { userId?: string; initiallyExpanded?: boolean }) {
  // Get sessions data with infinite loading
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useGetSessionsInfinite(userId) as any;

  // Combine all pages of data
  const flattenedData = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page: { data?: GetSessionsResponse }) => page.data || []);
  }, [data]);

  // Reference for the scroll container
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-refresh every 3 seconds
  useEffect(() => {
    let timer: any;
    const start = () => {
      // Only refetch when the tab is visible to avoid unnecessary calls
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refetch?.();
      }
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          refetch?.();
        }
      }, 3000);
    };

    start();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch?.();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [refetch]);

  if (error) return <div className="text-red-500 p-4">Error: {(error as Error).message}</div>;

  return (
    <div ref={containerRef} className="overflow-auto ">
      {isLoading ? (
        // Show skeleton cards while loading
        <SessionCardSkeleton />
      ) : flattenedData.length === 0 ? (
        <NothingFound
          icon={<Rewind className="w-10 h-10" />}
          title={"No sessions found"}
          description={"Try a different date range or filter"}
        />
      ) : (
        // Render session cards with more robust key generation
        flattenedData.map((session, index) => (
          <SessionCard key={`${session.session_id}-${index}`} session={session} userId={userId} initiallyExpanded={initiallyExpanded} />
        ))
      )}

      {isFetchingNextPage && (
        <div className="">
          <SessionCardSkeleton key="loading-more" />
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center py-2">
          <Button onClick={() => fetchNextPage()} className="w-full" variant="success">
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
