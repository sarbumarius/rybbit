import { FastifyReply, FastifyRequest } from "fastify";
import { clickhouse } from "../../db/clickhouse/clickhouse.js";
import { getFilterStatement, getTimeStatement, processResults } from "./utils.js";
import { getUserHasAccessToSitePublic } from "../../lib/auth-utils.js";
import { FilterParams } from "@rybbit/shared";

export type GetUsersResponse = {
    user_id: string;
    country: string;
    region: string;
    city: string;
    language: string;
    browser: string;
    operating_system: string;
    device_type: string;
    screen_width?: number;
    screen_height?: number;
    referrer?: string;
    pageviews: number;
    events: number;
    sessions: number;
    last_seen: string;
    first_seen: string;
    // Aggregated items across all sessions
    pageviews_items?: string[]; // full pageview URLs (pathname + querystring)
    actions_items?: string[];   // list of custom event names
    // Ecommerce-related aggregates
    products_pageviews?: number;
    add_to_cart_events?: number;
    has_products?: boolean;
    has_add_to_cart?: boolean;
    has_begin_checkout?: boolean;
    has_purchase?: boolean;
}[];

export interface GetUsersRequest {
    Params: {
        site: string;
    };
    Querystring: FilterParams<{
        page?: string;
        pageSize?: string;
        sortBy?: string;
        sortOrder?: string;
    }>;
}

export async function getUsers(req: FastifyRequest<GetUsersRequest>, res: FastifyReply) {
    const {
        startDate,
        endDate,
        timeZone,
        filters,
        page = "1",
        pageSize = "20",
        sortBy = "last_seen",
        sortOrder = "desc",
        pastMinutesStart,
        pastMinutesEnd,
    } = req.query;
    const site = req.params.site;

    const userHasAccessToSite = await getUserHasAccessToSitePublic(req, site);
    if (!userHasAccessToSite) {
        return res.status(403).send({ error: "Forbidden" });
    }

    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    const offset = (pageNum - 1) * pageSizeNum;

    // Validate sort parameters
    const validSortFields = ["first_seen", "last_seen", "pageviews", "sessions", "events"];
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : "last_seen";
    const actualSortOrder = sortOrder === "asc" ? "ASC" : "DESC";

    // Generate filter statement and time statement
    const filterStatement = getFilterStatement(filters);
    const timeStatement = getTimeStatement(req.query);

    const query = `
        WITH AggregatedUsers AS (
            SELECT
                user_id,
                argMax(country, timestamp) AS country,
                argMax(region, timestamp) AS region,
                argMax(city, timestamp) AS city,
                argMax(language, timestamp) AS language,
                argMax(browser, timestamp) AS browser,
                argMax(operating_system, timestamp) AS operating_system,
                argMax(device_type, timestamp) AS device_type,
                argMax(screen_width, timestamp) AS screen_width,
                argMax(screen_height, timestamp) AS screen_height,
                argMin(referrer, timestamp) AS referrer,
                countIf(type = 'pageview') AS pageviews,
                countIf(type = 'custom_event') AS events,
                count(distinct session_id) AS sessions,
                max(timestamp) AS last_seen,
                min(timestamp) AS first_seen,
                -- items across all sessions for this user
                groupArrayIf(concat(pathname, if(ifNull(querystring, '') != '', concat('?', ifNull(querystring, '')), '')), type = 'pageview') AS pageviews_items,
                groupArrayIf(event_name, type = 'custom_event') AS actions_items,
                -- ecommerce counts
                countIf(type = 'pageview' AND positionUTF8(ifNull(pathname, ''), '/produs/') > 0) AS products_pageviews,
                countIf(type = 'custom_event' AND lowerUTF8(ifNull(event_name, '')) IN ('addtocart','add_to_cart','add-to-cart')) AS add_to_cart_events,
                -- checkout/order flags (0/1 integers here)
                if(
                  countIf(type = 'pageview' AND positionUTF8(ifNull(pathname, ''), '/plata-cos/') > 0) > 0
                  OR countIf(type = 'custom_event' AND lowerUTF8(ifNull(event_name, '')) IN ('begin_checkout','checkout_started','start_checkout')) > 0,
                  1, 0
                ) AS has_begin_checkout_int,
                if(
                  countIf(type = 'pageview' AND positionUTF8(ifNull(pathname, ''), '/order-received/') > 0) > 0
                  OR countIf(type = 'custom_event' AND lowerUTF8(ifNull(event_name, '')) IN ('purchase','order_received')) > 0,
                  1, 0
                ) AS has_purchase_int
            FROM events
            WHERE
                site_id = {siteId:Int32}
                ${timeStatement}
                ${filterStatement}
            GROUP BY
                user_id
        )
        SELECT 
            *,
            products_pageviews > 0 AS has_products,
            add_to_cart_events > 0 AS has_add_to_cart,
            has_begin_checkout_int AS has_begin_checkout,
            has_purchase_int AS has_purchase
        FROM AggregatedUsers
        ORDER BY ${actualSortBy} ${actualSortOrder}
        LIMIT {limit:Int32} OFFSET {offset:Int32}
    `;

    // Query to get total count
    const countQuery = `
        SELECT
            count(DISTINCT user_id) AS total_count
        FROM events
        WHERE
            site_id = {siteId:Int32}
            ${filterStatement}
            ${timeStatement}
    `;

    try {
        // Execute both queries in parallel
        const [result, countResult] = await Promise.all([
            clickhouse.query({
                query,
                format: "JSONEachRow",
                query_params: {
                    siteId: Number(site),
                    limit: pageSizeNum,
                    offset,
                },
            }),
            clickhouse.query({
                query: countQuery,
                format: "JSONEachRow",
                query_params: {
                    siteId: Number(site),
                },
            }),
        ]);

        const data = await processResults<GetUsersResponse[number]>(result);
        const countData = await processResults<{ total_count: number }>(countResult);
        const totalCount = countData[0]?.total_count || 0;

        return res.send({
            data,
            totalCount,
            page: pageNum,
            pageSize: pageSizeNum,
        });
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).send({ error: "Failed to fetch users" });
    }
}