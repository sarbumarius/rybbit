"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EVENT_FILTERS } from "@/lib/store";
import { useGetEventNames } from "../../../api/analytics/events/useGetEventNames";
import { useGetOutboundLinks } from "../../../api/analytics/events/useGetOutboundLinks";
import { DisabledOverlay } from "../../../components/DisabledOverlay";
import { useSetPageTitle } from "../../../hooks/useSetPageTitle";
import { SubHeader } from "../components/SubHeader/SubHeader";
import { EventList } from "./components/EventList";
import { EventLog } from "./components/EventLog";
import { OutboundLinksList } from "./components/OutboundLinksList";
import { useMemo, useState } from "react";

export default function EventsPage() {
  useSetPageTitle("Rybbit · Events");

  const { data: eventNamesData, isLoading: isLoadingEventNames } = useGetEventNames();
  const { data: outboundLinksData, isLoading: isLoadingOutboundLinks } = useGetOutboundLinks();

  // Local search for Custom Events
  const [eventSearch, setEventSearch] = useState("");
  const filteredEvents = useMemo(() => {
    const list = eventNamesData || [];
    if (!eventSearch.trim()) return list;
    const q = eventSearch.toLowerCase();
    return list.filter(e => e.eventName.toLowerCase().includes(q));
  }, [eventNamesData, eventSearch]);

  return (
    <DisabledOverlay message="Events" featurePath="events">
      <div className="p-2 md:p-4 max-w-[1300px] mx-auto space-y-3">
        <SubHeader availableFilters={EVENT_FILTERS} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
          <div className="relative rounded-lg border h-[200px]  border-neutral-200 bg-white text-neutral-950 dark:border-neutral-850 dark:bg-neutral-900 dark:text-neutral-50 overflow-hidden transition-all duration-300 flex flex-col overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Custom Events</CardTitle>
                <Input
                  inputSize="sm"
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-8 w-40 md:w-60"
                  disabled={isLoadingEventNames}
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <EventList events={filteredEvents} isLoading={isLoadingEventNames} size="large" />
            </CardContent>
          </div>

          <Card className="h-auto lg:h-full lg:min-h-0 flex flex-col overflow-hidden lg:[contain:size]">
            <CardHeader>
              <CardTitle>Outbound Clicks</CardTitle>
            </CardHeader>
            <CardContent className="lg:flex-1 lg:min-h-0 overflow-hidden p-0">
              <div className="h-auto lg:h-full lg:min-h-0 p-4 pt-0">
                <OutboundLinksList
                  outboundLinks={outboundLinksData || []}
                  isLoading={isLoadingOutboundLinks}
                  size="large"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Event Log</CardTitle>
          </CardHeader>
          <CardContent>
            <EventLog />
          </CardContent>
        </Card>
      </div>
    </DisabledOverlay>
  );
}
