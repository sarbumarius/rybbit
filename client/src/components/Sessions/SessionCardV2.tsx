import { DateTime } from "luxon";
import { GetSessionsResponse } from "@/api/analytics/userSessions";
import { cn, formatter } from "@/lib/utils";
import { hour12, userLocale } from "@/lib/dateTimeUtils";
import { Badge } from "@/components/ui/badge";
import { FileText, MousePointerClick, TriangleAlert, ExternalLink } from "lucide-react";

interface SessionCardV2Props {
  session: GetSessionsResponse[number];
  selected?: boolean;
  onSelect?: () => void;
}

export function SessionCardV2({ session, selected = false, onSelect }: SessionCardV2Props) {
  const start = DateTime.fromSQL(session.session_start, { zone: "utc" }).toLocal();
  const now = DateTime.local();
  const diffMinutes = now.diff(start, "minutes").as("minutes");
  const label =
    diffMinutes >= 0 && diffMinutes < 60
      ? `acum ${Math.max(1, Math.floor(diffMinutes))} min`
      : start.setLocale(userLocale).toFormat(hour12 ? "MMM d, h:mm a" : "dd MMM, HH:mm");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left px-2 py-2 rounded-md border transition-colors",
        selected
          ? "bg-neutral-800 border-neutral-700"
          : "bg-neutral-900 hover:bg-neutral-850 border-neutral-800"
      )}
      title={`${session.user_id}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-md font-mono text-neutral-400 hidden xl:inline">{session.user_id.slice(0, 12)}</span>
      </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-300 truncate">{label}</span>
        </div>
      {/* City, Screen, Device, IP */}
      <div className="mt-1 text-[10px] text-neutral-400 grid grid-cols-1 gap-1">


          {session.ip ? <div className="truncate" title={session.ip}>{session.ip}</div> : null}

        {session.city ? <span className="truncate" title={session.city}>{session.city}</span> : null}
        {/*{session.screen_width && session.screen_height ? (*/}
        {/*  <span className="text-neutral-500">•</span>*/}
        {/*) : null}*/}
        {session.screen_width && session.screen_height ? (
          <span>
            {session.screen_width} × {session.screen_height}
          </span>
        ) : null}
        {session.device_type ? (
          <span title={session.device_type}>{session.device_type}</span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-neutral-300">
        <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">
          <FileText className="w-3 h-3 text-blue-500" />
          {formatter(session.pageviews)}
        </Badge>
        <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">
          <MousePointerClick className="w-3 h-3 text-amber-500" />
          {formatter(session.events)}
        </Badge>
        <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">
          <TriangleAlert className="w-3 h-3 text-red-500" />
          {formatter(session.errors)}
        </Badge>
        <Badge variant="outline" className="h-5 px-1 gap-1 bg-neutral-800 text-neutral-200">
          <ExternalLink className="w-3 h-3 text-purple-500" />
          {formatter(session.outbound)}
        </Badge>
      </div>
    </button>
  );
}

export function SessionCardV2Skeleton() {
  return (
    <div className="w-full px-2 py-2 rounded-md border border-neutral-800 bg-neutral-900">
      <div className="h-3 w-24 bg-neutral-800 rounded animate-pulse" />
      <div className="mt-2 flex items-center gap-1">
        <div className="h-5 w-10 bg-neutral-800 rounded animate-pulse" />
        <div className="h-5 w-10 bg-neutral-800 rounded animate-pulse" />
        <div className="h-5 w-10 bg-neutral-800 rounded animate-pulse" />
        <div className="h-5 w-10 bg-neutral-800 rounded animate-pulse" />
      </div>
    </div>
  );
}
