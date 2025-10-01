import { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../../../db/postgres/postgres.js";
import { goals } from "../../../db/postgres/schema.js";
import { clickhouse } from "../../../db/clickhouse/clickhouse.js";
import { getUserHasAccessToSitePublic } from "../../../lib/auth-utils.js";
import { eq, desc, asc, sql } from "drizzle-orm";
import { getFilterStatement, getTimeStatement, processResults, patternToRegex } from "../utils.js";
import SqlString from "sqlstring";
import { FilterParams } from "@rybbit/shared";

// Types for the response
interface GoalWithConversions {
  goalId: number;
  name: string | null;
  goalType: string;
  config: any;
  createdAt: string | null;
  total_conversions: number;
  total_sessions: number;
  conversion_rate: number;
  // Added: explain what and where this goal matches
  match_scope: "pathname" | "custom_event"; // where we search
  // For path-type goals
  path_pattern?: string | null;
  path_regex?: string | null;
  matched_pages?: string[] | null;
  // New: one entry per distinct converting session with minimal details
  matched_conversions?: Array<{
    session_id: string;
    user_id: string | null;
    pathname: string | null;
    entry_page?: string | null;
    exit_page?: string | null;
    matched_at?: string | null;
  }> | null;
  // For event-type goals
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

interface GetGoalsResponse {
  data: GoalWithConversions[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export async function getGoals(
  request: FastifyRequest<{
    Params: {
      site: string;
    };
    Querystring: FilterParams<{
      page?: string;
      pageSize?: string;
      sort?: string;
      order?: "asc" | "desc";
    }>;
  }>,
  reply: FastifyReply
) {
  const { site } = request.params;
  const {
    startDate,
    endDate,
    timeZone,
    filters,
    page = "1",
    pageSize = "1000000",
    sort = "createdAt",
    order = "desc",
    pastMinutesStart,
    pastMinutesEnd,
  } = request.query;

  const pageNumber = parseInt(page, 10);
  const pageSizeNumber = parseInt(pageSize, 10);

  // Validate page and pageSize
  if (isNaN(pageNumber) || pageNumber < 1) {
    return reply.status(400).send({ error: "Invalid page number" });
  }

  if (isNaN(pageSizeNumber) || pageSizeNumber < 1 || pageSizeNumber > 1000000) {
    return reply.status(400).send({ error: "Invalid page size, must be between 1 and 1000000" });
  }

  // Check user access to site
  const userHasAccessToSite = await getUserHasAccessToSitePublic(request, site);
  if (!userHasAccessToSite) {
    return reply.status(403).send({ error: "Forbidden" });
  }

  try {
    // Count total goals for pagination metadata
    const totalGoalsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(goals)
      .where(eq(goals.siteId, Number(site)));

    const totalGoals = totalGoalsResult[0]?.count || 0;
    const totalPages = Math.ceil(totalGoals / pageSizeNumber);

    // If no goals exist, return early with empty data
    if (totalGoals === 0) {
      return reply.send({
        data: [],
        meta: {
          total: 0,
          page: pageNumber,
          pageSize: pageSizeNumber,
          totalPages: 0,
        },
      });
    }

    // Apply sorting
    let orderBy;
    // Only allow sorting by valid columns
    const validSortColumns = ["goalId", "name", "goalType", "createdAt"];
    const sortColumn = validSortColumns.includes(sort) ? sort : "createdAt";

    if (order === "asc") {
      if (sortColumn === "goalId") orderBy = asc(goals.goalId);
      else if (sortColumn === "name") orderBy = asc(goals.name);
      else if (sortColumn === "goalType") orderBy = asc(goals.goalType);
      else orderBy = asc(goals.createdAt);
    } else {
      if (sortColumn === "goalId") orderBy = desc(goals.goalId);
      else if (sortColumn === "name") orderBy = desc(goals.name);
      else if (sortColumn === "goalType") orderBy = desc(goals.goalType);
      else orderBy = desc(goals.createdAt);
    }

    // Fetch paginated goals for this site from PostgreSQL
    const siteGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.siteId, Number(site)))
      .orderBy(orderBy)
      .limit(pageSizeNumber)
      .offset((pageNumber - 1) * pageSizeNumber);

    if (siteGoals.length === 0) {
      // If no goals for this page, return empty data
      return reply.send({
        data: [],
        meta: {
          total: totalGoals,
          page: pageNumber,
          pageSize: pageSizeNumber,
          totalPages,
        },
      });
    }

    // Build filter and time clauses for ClickHouse queries
    const filterStatement = filters ? getFilterStatement(filters) : "";
    const timeStatement = getTimeStatement(request.query);

    // First, get the total number of unique sessions (denominator for conversion rate)
    const totalSessionsQuery = `
      SELECT COUNT(DISTINCT session_id) AS total_sessions
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
      ${timeStatement}
      ${filterStatement}
    `;

    const totalSessionsResult = await clickhouse.query({
      query: totalSessionsQuery,
      format: "JSONEachRow",
    });

    const totalSessionsData = await processResults<{ total_sessions: number }>(totalSessionsResult);
    const totalSessions = totalSessionsData[0]?.total_sessions || 0;

    // Build a single query that calculates all goal conversions at once using conditional aggregation
    // This is more efficient than separate queries for each goal
    let conditionalClauses: string[] = [];

    for (const goal of siteGoals) {
      if (goal.goalType === "path") {
        const pathPattern = goal.config.pathPattern;
        if (!pathPattern) continue;

        // Support hash-based contains with both leading and trailing '#', e.g. '#gclid#' => contains in FULL URL (path + params)
        const hashContainsMatch = pathPattern.match(/^#(.+)#$/);
        // Support parameter search with leading '#', e.g. '#gclid' -> search in querystring contains
        const isParamSearch = !hashContainsMatch && pathPattern.startsWith('#');
        let effectivePattern = isParamSearch ? pathPattern.slice(1) : (hashContainsMatch ? hashContainsMatch[1] : pathPattern);
        // Force contains semantics for hashContains and paramSearch when not already using *** marker
        if ((hashContainsMatch || isParamSearch) && !effectivePattern.includes('***')) {
          effectivePattern = `***${effectivePattern}***`;
        }
        // Build regex based on effective pattern (supports **, *, and *** contains)
        const regex = patternToRegex(effectivePattern);

        // Decide which field to match against
        // - If '#term#': contains on FULL URL (pathname + '?' + querystring)
        // - If starts with '#': contains on querystring only
        // - Else if pattern uses *** contains: allow contains across full URL (pathname + '?' + querystring)
        // - Else: classic pathname match
        const targetExpr = hashContainsMatch
          ? "concat(ifNull(pathname, ''), '?', ifNull(querystring, ''))"
          : isParamSearch
            ? "ifNull(querystring, '')"
            : (effectivePattern.includes('***')
                ? "concat(ifNull(pathname, ''), '?', ifNull(querystring, ''))"
                : "pathname");

        conditionalClauses.push(`
          COUNT(DISTINCT IF(
            type = 'pageview' AND match(${targetExpr}, ${SqlString.escape(regex)}),
            session_id,
            NULL
          )) AS goal_${goal.goalId}_conversions
        `);
        conditionalClauses.push(`
          groupUniqArrayIf(pathname,
            type = 'pageview' AND match(${targetExpr}, ${SqlString.escape(regex)})
          ) AS goal_${goal.goalId}_matched_pages
        `);
        // One object per distinct converting session, JSON-encoded for transport
        conditionalClauses.push(`
          groupUniqArrayIf(
            toJSONString(map(
              'session_id', toString(session_id),
              'user_id', nullIf(toString(user_id), ''),
              'pathname', nullIf(pathname, ''),
              'entry_page', (SELECT argMin(pathname, timestamp) FROM events AS ev2 WHERE ev2.session_id = events.session_id),
              'exit_page', (SELECT argMax(pathname, timestamp) FROM events AS ev2 WHERE ev2.session_id = events.session_id),
              'matched_at', (SELECT toString(min(timestamp)) FROM events AS ev2 WHERE ev2.session_id = events.session_id AND type = 'pageview' AND match(${targetExpr}, ${SqlString.escape(regex)}))
            )),
            type = 'pageview' AND match(${targetExpr}, ${SqlString.escape(regex)})
          ) AS goal_${goal.goalId}_matched_conversions_json
        `);
      } else if (goal.goalType === "event") {
        const eventName = goal.config.eventName;
        const eventPropertyKey = goal.config.eventPropertyKey;
        const eventPropertyValue = goal.config.eventPropertyValue;

        if (!eventName) continue;

        let eventClause = `type = 'custom_event' AND event_name = ${SqlString.escape(eventName)}`;

        // Add property matching if needed
        if (eventPropertyKey && eventPropertyValue !== undefined) {
          // Access the sub-column directly for native JSON type
          const propValueAccessor = `props.${SqlString.escapeId(eventPropertyKey)}`;

          // Comparison needs to handle the Dynamic type returned
          // Let ClickHouse handle the comparison based on the provided value type
          if (typeof eventPropertyValue === "string") {
            eventClause += ` AND toString(${propValueAccessor}) = ${SqlString.escape(eventPropertyValue)}`;
          } else if (typeof eventPropertyValue === "number") {
            // Use toFloat64 or toInt* depending on expected number type
            eventClause += ` AND toFloat64OrNull(${propValueAccessor}) = ${SqlString.escape(eventPropertyValue)}`;
          } else if (typeof eventPropertyValue === "boolean") {
            // Booleans might be stored as 0/1 or true/false in JSON
            // Comparing toUInt8 seems robust
            eventClause += ` AND toUInt8OrNull(${propValueAccessor}) = ${eventPropertyValue ? 1 : 0}`;
          }
        }

        conditionalClauses.push(`
          COUNT(DISTINCT IF(
            ${eventClause},
            session_id,
            NULL
          )) AS goal_${goal.goalId}_conversions
        `);
        conditionalClauses.push(`
          groupUniqArrayIf(event_name,
            ${eventClause}
          ) AS goal_${goal.goalId}_matched_actions
        `);
        conditionalClauses.push(`
          groupUniqArrayIf(
            toJSONString(map(
              'session_id', toString(session_id),
              'user_id', nullIf(toString(user_id), ''),
              'event_name', nullIf(event_name, ''),
              'pathname', nullIf(pathname, ''),
              'matched_at', (SELECT toString(min(timestamp)) FROM events AS ev2 WHERE ev2.session_id = events.session_id AND ${eventClause})
            )),
            ${eventClause}
          ) AS goal_${goal.goalId}_matched_actions_details_json
        `);
      }
    }

    if (conditionalClauses.length === 0) {
      // If no valid goals to calculate, return the goals without conversion data
      const goalsWithZeroConversions = siteGoals.map(goal => ({
        ...goal,
        total_conversions: 0,
        total_sessions: totalSessions,
        conversion_rate: 0,
      }));

      return reply.send({
        data: goalsWithZeroConversions,
        meta: {
          total: totalGoals,
          page: pageNumber,
          pageSize: pageSizeNumber,
          totalPages,
        },
      });
    }

    // Execute the comprehensive query
    const conversionQuery = `
      SELECT
        ${conditionalClauses.join(", ")}
      FROM events
      WHERE site_id = ${SqlString.escape(Number(site))}
      ${timeStatement}
      ${filterStatement}
    `;

    const conversionResult = await clickhouse.query({
      query: conversionQuery,
      format: "JSONEachRow",
    });

    const conversionData = await processResults<Record<string, any>>(conversionResult);

    // If we didn't get any results, use zeros
    const conversions = conversionData[0] || {};

    // Combine goals data with conversion metrics
    const goalsWithConversions: GoalWithConversions[] = siteGoals.map(goal => {
      const totalConversions = conversions[`goal_${goal.goalId}_conversions`] || 0;
      const conversionRate = totalSessions > 0 ? totalConversions / totalSessions : 0;

      // Build match metadata
      const isPath = goal.goalType === "path";
      const pathPattern: string | null = isPath ? (goal.config?.pathPattern ?? null) : null;
      // Compute regex reflecting special hash patterns:
      // - '#term#' => contains on full URL (path + params)
      // - '#term'  => contains on querystring only
      let pathRegex: string | null = null;
      if (isPath && pathPattern) {
        const fullContains = pathPattern.match(/^#(.+)#$/);
        if (fullContains) {
          pathRegex = patternToRegex(`***${fullContains[1]}***`);
        } else if (pathPattern.startsWith('#')) {
          pathRegex = patternToRegex(`***${pathPattern.slice(1)}***`);
        } else {
          pathRegex = patternToRegex(pathPattern);
        }
      }
      const eventName: string | null = !isPath ? (goal.config?.eventName ?? null) : null;
      const eventPropKey: string | null = !isPath ? (goal.config?.eventPropertyKey ?? null) : null;
      const eventPropVal: string | number | boolean | null = !isPath
        ? (goal.config?.eventPropertyValue ?? null)
        : null;

      // Matched items arrays from aggregated query
      const matchedPages = conversions[`goal_${goal.goalId}_matched_pages`] || null;
      const matchedConversionsJson = conversions[`goal_${goal.goalId}_matched_conversions_json`] || null;
      const matchedActions = conversions[`goal_${goal.goalId}_matched_actions`] || null;
      const matchedActionsDetailsJson = conversions[`goal_${goal.goalId}_matched_actions_details_json`] || null;

      // Parse JSON strings to objects for matched_conversions, ensure array
      let matchedConversions: GoalWithConversions["matched_conversions"] = null;
      if (isPath && Array.isArray(matchedConversionsJson)) {
        matchedConversions = matchedConversionsJson
          .filter((s: any) => typeof s === "string" && s.length)
          .map((s: string) => {
            try {
              const obj = JSON.parse(s);
              return {
                session_id: String(obj.session_id || ""),
                user_id: obj.user_id ?? null,
                pathname: obj.pathname ?? null,
                entry_page: obj.entry_page ?? null,
                exit_page: obj.exit_page ?? null,
                matched_at: obj.matched_at ?? null,
              };
            } catch {
              return null;
            }
          })
          .filter((x: any) => x !== null) as any;
      }

      // Parse event action details
      let matchedActionsDetails: GoalWithConversions["matched_actions"] | null = null;
      if (!isPath && Array.isArray(matchedActionsDetailsJson)) {
        matchedActionsDetails = matchedActionsDetailsJson
          .filter((s: any) => typeof s === "string" && s.length)
          .map((s: string) => {
            try {
              const obj = JSON.parse(s);
              return {
                session_id: String(obj.session_id || ""),
                user_id: obj.user_id ?? null,
                event_name: obj.event_name ?? null,
                pathname: obj.pathname ?? null,
                matched_at: obj.matched_at ?? null,
              } as any;
            } catch {
              return null;
            }
          })
          .filter((x: any) => x !== null) as any;
      }

      return {
        ...goal,
        total_conversions: totalConversions,
        total_sessions: totalSessions,
        conversion_rate: conversionRate,
        match_scope: isPath ? "pathname" : "custom_event",
        path_pattern: pathPattern,
        path_regex: pathRegex,
        matched_pages: isPath ? (matchedPages as string[] | null) : null,
        matched_conversions: matchedConversions,
        event_name: eventName,
        event_property_key: eventPropKey,
        event_property_value: eventPropVal,
        matched_actions: !isPath ? (matchedActions as string[] | null) : null,
        matched_actions_details: !isPath ? (matchedActionsDetails as any) : null,
      } as GoalWithConversions;
    });

    return reply.send({
      data: goalsWithConversions,
      meta: {
        total: totalGoals,
        page: pageNumber,
        pageSize: pageSizeNumber,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return reply.status(500).send({ error: "Failed to fetch goals data" });
  }
}
