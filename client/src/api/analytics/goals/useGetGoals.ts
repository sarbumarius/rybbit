import { useQuery } from "@tanstack/react-query";
import { getFilteredFilters, GOALS_PAGE_FILTERS, useStore } from "../../../lib/store";
import { authedFetch, getQueryParams } from "../../utils";

export interface Goal {
  goalId: number;
  name: string | null;
  goalType: "path" | "event";
  config: {
    pathPattern?: string;
    eventName?: string;
    eventPropertyKey?: string;
    eventPropertyValue?: string | number | boolean;
  };
  createdAt: string;
  total_conversions: number;
  total_sessions: number;
  conversion_rate: number;
  // Enriched fields from API
  match_scope?: "pathname" | "custom_event";
  // Path goal fields
  path_pattern?: string | null;
  path_regex?: string | null;
  matched_pages?: string[] | null;
  matched_conversions?: Array<{
    session_id: string;
    user_id: string | null;
    pathname: string | null;
    entry_page?: string | null;
    exit_page?: string | null;
    matched_at?: string | null;
  }> | null;
  // Event goal fields
  event_name?: string | null;
  event_property_key?: string | null;
  event_property_value?: string | number | boolean | null;
  matched_actions?: string[] | null;
  matched_actions_details?: Array<{
    session_id: string;
    user_id: string | null;
    event_name: string | null;
    pathname?: string | null;
    matched_at?: string | null;
  }> | null;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface GoalsResponse {
  data: Goal[];
  meta: PaginationMeta;
}

export function useGetGoals({
  page = 1,
  pageSize = 10,
  sort = "createdAt",
  order = "desc",
  enabled = true,
}: {
  page?: number;
  pageSize?: number;
  sort?: "goalId" | "name" | "goalType" | "createdAt";
  order?: "asc" | "desc";
  enabled?: boolean;
}) {
  const { site, time } = useStore();
  const filteredFilters = getFilteredFilters(GOALS_PAGE_FILTERS);

  const timeParams = getQueryParams(time);

  return useQuery({
    queryKey: ["goals", site, timeParams, filteredFilters, page, pageSize, sort, order],
    queryFn: async () => {
      return authedFetch<GoalsResponse>(`/goals/${site}`, {
        ...timeParams,
        filteredFilters,
        page,
        pageSize,
        sort,
        order,
      });
    },
    enabled: !!site && enabled,
  });
}
