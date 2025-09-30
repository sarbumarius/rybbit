import { CopyText } from "@/components/CopyText";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Monitor,
  MousePointerClick,
  Smartphone,
  Tablet,
  TriangleAlert,
  RefreshCw,
  Gift,
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  User,
  Fingerprint,
  MapPin,
  Globe,
  SortAsc,
  SortDesc,
} from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";
import { useParams } from "next/navigation";
import { memo, useEffect, useMemo, useState } from "react";
import { GetSessionsResponse, SessionEvent, useGetSessionDetailsInfinite } from "../../api/analytics/userSessions";
import { Browser } from "../../app/[site]/components/shared/icons/Browser";
import { CountryFlag } from "../../app/[site]/components/shared/icons/CountryFlag";
import { OperatingSystem } from "../../app/[site]/components/shared/icons/OperatingSystem";
import { cn, getCountryName, getLanguageName } from "../../lib/utils";
import { formatDuration } from "../../lib/dateTimeUtils";
import { Button } from "../ui/button";
import { hour12 } from "../../lib/dateTimeUtils";
import { useGetRegionName } from "../../lib/geo";
import { Avatar } from "../Avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Known marketing identifiers and their friendly names
const MARKETING_IDENTIFIERS: { identificator: string; name: string }[] = [
  { identificator: "fbclid", name: "Facebook" },
  { identificator: "gclid", name: "Google Ads" },
  { identificator: "wbraid", name: "Google Ads (Web)" },
  { identificator: "gbraid", name: "Google Ads (App)" },
  { identificator: "dclid", name: "Google Display" },
  { identificator: "msclkid", name: "Microsoft Ads (Bing)" },
  { identificator: "ttclid", name: "TikTok Ads" },
  { identificator: "twclid", name: "Twitter Ads" },
  { identificator: "li_fat_id", name: "LinkedIn Ads" },
  { identificator: "igshid", name: "Instagram" },
  { identificator: "mc_eid", name: "Mailchimp" },
  { identificator: "yclid", name: "Yandex Ads" },
  { identificator: "utm_source", name: "UTM - Source" },
  { identificator: "utm_medium", name: "UTM - Medium" },
  { identificator: "utm_campaign", name: "UTM - Campaign" },
  { identificator: "utm_term", name: "UTM - Term" },
  { identificator: "utm_content", name: "UTM - Content" },
];

function extractMarketingKeysFromQuery(querystring?: string | null): string[] {
  if (!querystring) return [];
  try {
    const qs = querystring.startsWith("?") ? querystring.slice(1) : querystring;
    const sp = new URLSearchParams(qs);
    const keys: string[] = [];
    for (const { identificator } of MARKETING_IDENTIFIERS) {
      if (sp.has(identificator)) keys.push(identificator);
    }
    return keys;
  } catch {
    // Fallback: simple contains check
    const keys: string[] = [];
    for (const { identificator } of MARKETING_IDENTIFIERS) {
      if (querystring.includes(identificator + "=")) keys.push(identificator);
    }
    return keys;
  }
}

// Icon (or badge) for known marketing sources
function MarketingIcon({ id, className = "w-3.5 h-3.5" }: { id: string; className?: string }) {
  // Use brand icons where available; fallback to a colored dot with initial
  const base = id.toLowerCase();
  const initial = base.startsWith("utm_") ? "U" : base[0]?.toUpperCase() || "?";
  const color =
    base === "fbclid" ? "bg-[#1877F2]" :
    base === "gclid" || base === "wbraid" || base === "gbraid" || base === "dclid" ? "bg-[#4285F4]" :
    base === "ttclid" ? "bg-[#000000]" :
    base === "twclid" ? "bg-[#1DA1F2]" :
    base === "li_fat_id" ? "bg-[#0A66C2]" :
    base === "igshid" ? "bg-[#E1306C]" :
    base === "msclkid" ? "bg-[#008373]" :
    base === "mc_eid" ? "bg-[#FF7E00]" :
    base === "yclid" ? "bg-[#FF0000]" :
    base.startsWith("utm_") ? "bg-[#6B7280]" :
    "bg-neutral-500";
  return (
    <span className={`inline-flex items-center justify-center ${className} rounded-full text-[9px] font-bold text-white ${color}`}
      aria-hidden>
      {initial}
    </span>
  );
}

function getAllQueryParams(querystring?: string | null): [string, string][] {
  if (!querystring) return [];
  try {
    const qs = querystring.startsWith("?") ? querystring.slice(1) : querystring;
    const sp = new URLSearchParams(qs);
    const arr: [string, string][] = [];
    sp.forEach((v, k) => arr.push([k, v]));
    return arr;
  } catch {
    return [];
  }
}

// Component to display a single pageview or event
function PageviewItem({
                        item,
                        index,
                        isLast = false,
                        nextTimestamp,
                        displayNumber,
                        anchorId,
                        showCampaigns,
                        showProducts,
                      }: {
  item: SessionEvent;
  index: number;
  isLast?: boolean;
  nextTimestamp?: string; // Timestamp of the next event for duration calculation
  displayNumber?: number;
  anchorId?: string;
  showCampaigns: boolean;
  showProducts: boolean;
}) {
  const isError = item.type === "error";
  const isEvent = item.type === "custom_event";
  const isPageview = item.type === "pageview";
  const isOutbound = item.type === "outbound";
  const timestamp = DateTime.fromSQL(item.timestamp, { zone: "utc" }).toLocal();
  const formattedTime = timestamp.toFormat(hour12 ? "h:mm:ss a" : "HH:mm:ss");

  // Extract known marketing identifiers from querystring (for pageviews)
  const marketingKeys: string[] = isPageview ? extractMarketingKeysFromQuery(item.querystring || undefined) : [];

  // Extract product slug if pathname contains /produs/
  const productSlug: string | null = (() => {
    if (!isPageview || !item.pathname) return null;
    try {
      const match = String(item.pathname).match(/\/produs\/([^\/?#]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    } catch {}
    return null;
  })();

  // Display label: if product page, show only slug; otherwise original pathname + optional query
  const displayLabel = productSlug ? productSlug : `${item.pathname}${item.querystring ? `${item.querystring}` : ""}`;

  // Product info fetching state
  const [productInfo, setProductInfo] = useState<null | {
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
  }>(null);
  const [productLoading, setProductLoading] = useState<boolean>(false);
  const [productError, setProductError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      if (!productSlug) return;
      try {
        setProductLoading(true);
        setProductError(null);
        const data = await fetchProductInfoWithCache(productSlug);
        if (!aborted) setProductInfo(data);
      } catch (e: any) {
        if (!aborted) setProductError(e?.message || "Failed to load product");
      } finally {
        if (!aborted) setProductLoading(false);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [productSlug]);

  // Calculate duration if this is a pageview and we have the next timestamp
  let duration = null;
  if (isPageview && nextTimestamp) {
    const nextTime = DateTime.fromSQL(nextTimestamp, { zone: "utc" }).toLocal();
    const totalSeconds = Math.floor(nextTime.diff(timestamp).milliseconds / 1000);
    duration = formatDuration(totalSeconds);
  }

  return (
    <div className="flex mb-3" id={anchorId}>
      {/* Timeline circle with number */}
      <div className="relative flex-shrink-0">
        {!isLast && (
          <div
            className="absolute top-7 left-3 w-[1px] bg-neutral-700"
            style={{
              height: "calc(100% - 20px)",
            }}
          />
        )}
        {/* Connecting line */}
        <div
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full border",
            isEvent
              ? "bg-amber-900/30 border-amber-500/50"
              : isError
                ? "bg-red-900/30 border-red-500/50"
                : isOutbound
                  ? "bg-purple-900/30 border-purple-500/50"
                  : "bg-blue-900/30 border-blue-500/50"
          )}
        >
          <span className="text-[8px] font-medium">{displayNumber ?? index + 1}</span>
        </div>
      </div>

      <div className="flex flex-col ml-3 flex-1 ">
        <div className="flex items-center flex-1 py-1">
          <div className="flex-shrink-0 mr-3">
            {isEvent ? (
              <MousePointerClick className="w-4 h-4 text-amber-500" />
            ) : isError ? (
              <TriangleAlert className="w-4 h-4 text-red-500" />
            ) : isOutbound ? (
              <ExternalLink className="w-4 h-4 text-purple-500" />
            ) : (
              <FileText className="w-4 h-4 text-blue-500" />
            )}
          </div>

          <div className="flex-1 min-w-0 mr-4 text-[12px]">
            {isPageview ? (
              <Link
                href={`https://${item.hostname}${item.pathname}${item.querystring ? `${item.querystring}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div
                  className="text-[12px] truncate hover:underline max-w-[20vw]"
                  title={item.pathname}



                >
                  {displayLabel}
                </div>
              </Link>
            ) : isOutbound && item.props?.url ? (
              <Link href={String(item.props.url)} target="_blank" rel="noopener noreferrer">
                <div
                  className="text-[12px] truncate hover:underline text-purple-400"
                  title={String(item.props.url)}
                  style={{
                    maxWidth: "calc(min(100vw, 1150px) - 250px)",
                  }}
                >
                  {String(item.props.url)}
                </div>
              </Link>
            ) : (
              <div className="text-[12px] truncate">{item.event_name || "Outbound Click"}</div>
            )}
          </div>

          <div className="text-xs text-neutral-400 flex-shrink-0">{formattedTime}</div>
        </div>
        {isPageview && duration && (
          <div className="flex items-center pl-7 mt-1">
            <div className="text-xs text-neutral-400">
              <Clock className="w-3 h-3 inline mr-1 text-neutral-400" />
              {duration}
            </div>
          </div>
        )}
        {isPageview && marketingKeys.length > 0 && showCampaigns && (
          <div className="pl-7 mt-1">
            {/* Primary tracked identifiers */}
            <div className="flex flex-wrap gap-2 items-center">
              {marketingKeys.map((key) => {
                const info = MARKETING_IDENTIFIERS.find((m) => m.identificator === key);
                return (
                  <div key={key} className="flex items-center gap-1.5 text-[11px] bg-neutral-800 border border-neutral-700 rounded px-2 py-1 leading-tight">
                    <MarketingIcon id={key} />
                    <span className="font-mono text-neutral-200">{key}</span>
                    <span className="text-neutral-400 text-[10px] -mt-0.5">{info?.name || "Marketing Param"}</span>
                  </div>
                );
              })}
              {(() => {
                // Extra params only when at least one tracked identifier exists and there are more params present
                const allParams = getAllQueryParams(item.querystring || undefined);
                if (!allParams.length) return null;
                const trackedSet = new Set(marketingKeys);
                const extras = allParams.filter(([k]) => !trackedSet.has(k));
                if (extras.length === 0) return null;
                return (
                  <div className="flex items-center flex-wrap gap-2 ml-1">
                    {/* Divider dot */}
                    <span className="inline-block w-1 h-1 rounded-full bg-neutral-600 mx-1" />
                    {extras.map(([k, v]) => (
                      <Tooltip key={`${k}=${v}`}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="h-5 px-1.5 text-[10px] bg-neutral-900 text-neutral-200 border-neutral-800 cursor-default"
                            title={String(v)}
                          >
                            <span className="font-mono text-neutral-300">{k}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="font-mono text-[11px] break-all">
                            {k}={String(v)}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
        {isPageview && productSlug && showProducts && (
          <div className="flex items-start pl-7 mt-2">
            {productLoading ? (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Loading product…</span>
              </div>
            ) : productInfo && productInfo.ok ? (
              <div className="flex items-center gap-3 p-2 border border-neutral-800 rounded-md bg-neutral-900/50">
                {productInfo.poza ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={productInfo.poza} alt={productInfo.nume || productInfo.slug || productSlug} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-neutral-800 rounded" />
                )}
                <div className="min-w-0">
                  <div className="text-xs text-neutral-200 font-medium truncate max-w-[220px]" title={productInfo.nume || productInfo.slug || productSlug}>
                    {productInfo.nume || productInfo.slug || productSlug}
                  </div>
                  <div className="text-[11px] text-neutral-300 mt-0.5 flex items-center gap-2">
                    {typeof productInfo.pret_regular === "number" && productInfo.pret_redus && productInfo.pret_redus < productInfo.pret_regular ? (
                      <>
                        <span className="line-through text-neutral-500">{productInfo.pret_regular} RON</span>
                        <span className="text-green-400 font-semibold">{productInfo.pret_redus} RON</span>
                      </>
                    ) : (
                      <span className="text-neutral-200 font-semibold">{productInfo.pret ?? productInfo.pret_redus ?? ""} {productInfo.pret || productInfo.pret_redus ? "RON" : ""}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : productError ? (
              <div className="text-[11px] text-red-400">{productError}</div>
            ) : null}
          </div>
        )}
        {isEvent && (
          <div className="flex items-center pl-7 mt-1">
            <div className="text-xs text-neutral-400">
              {item.props && Object.keys(item.props).length > 0 ? (
                <span className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(item.props).map(([key, value]) => (
                    <div
                      key={key}

                      className=" w-full text-xs  text-neutral-100 font-medium border border-1 rounded-md ps-3 pb-1 pt-1 border-neutral-800 h-auto "
                    >
                      <div className="text-neutral-300 font-light mr-1 w-full">

                      <div className="w-full block whitespace-pre-wrap">
                        {key}:</div>{" "}
                      </div>

                          <div className="w-full block whitespace-pre-wrap">
                            {(() => {
                              const str = typeof value === "object" ? JSON.stringify(value) : String(value);
                              const urlMatch = str.match(/https?:\/\/[^\s|\"]+/i);
                              if (urlMatch) {
                                const url = urlMatch[0];
                                const prodMatch = url.match(/\/produs\/([^\/?#]+)/i);
                                if (prodMatch && prodMatch[1]) {
                                  try {
                                    const slug = decodeURIComponent(prodMatch[1]);
                                    return <ProductBadge slug={slug} />;
                                  } catch {
                                    return (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 underline"
                                      >
                                        vezi link
                                      </a>
                                    );
                                  }
                                }
                                return (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 underline"
                                  >
                                    vezi link
                                  </a>
                                );
                              }
                              if (str.includes("|")) {
                                return str.split("|").map((seg, i) => <div key={i}>{seg.trim()}</div>);
                              }
                              return str;
                            })()}
                          </div>



                    </div>
                  ))}
                </span>
              ) : null}
            </div>
          </div>
        )}
        {isOutbound && (
          <div className="flex items-center pl-7 mt-1">
            <div className="text-xs text-neutral-400">
              {item.props && Object.keys(item.props).length > 0 ? (
                <span className="flex flex-wrap gap-2 mt-1">
                  {item.props.text ? (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 h-5 text-xs bg-neutral-800 text-neutral-100 font-medium"
                    >
                      <span className="text-neutral-300 font-light mr-1 truncate">text:</span> {String(item.props.text)}
                    </Badge>
                  ) : null}
                  {item.props.target ? (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 h-5 text-xs bg-neutral-800 text-neutral-100 font-medium"
                    >
                      <span className="text-neutral-300 font-light mr-1 truncate">target:</span> {String(item.props.target)}
                    </Badge>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
        )}
        {isError && (
          <div className="flex items-center pl-7 mt-1">
            <div className="text-xs text-neutral-400">
              {item.props ? (
                <span>
                  {item.props.message && (
                    <Badge
                      key="message"
                      variant="outline"
                      className="px-1.5 py-0 h-5 text-xs bg-neutral-800 text-neutral-100 font-medium"
                    >
                      <span className="text-neutral-300 font-light mr-1 truncate">message:</span> {String(item.props.message)}
                    </Badge>
                  )}

                  {item.props.stack && (
                    <div>
                      <p className="mt-2 mb-1 text-neutral-300 font-light">Stack Trace:</p>
                      <pre className="text-xs text-neutral-100 bg-neutral-800 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                        {item.props.stack}
                      </pre>
                    </div>
                  )}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Memoized skeleton component for the session details timeline
const SessionDetailsTimelineSkeleton = memo(({ itemCount }: { itemCount: number }) => {
  // Function to get a random width class for skeletons
  const getRandomWidth = () => {
    const widths = ["w-28", "w-36", "w-44", "w-52", "w-60", "w-72", "w-80", "w-96", "w-full"];
    return widths[Math.floor(Math.random() * widths.length)];
  };

  return (
    <div className="py-4">
      {/* Tabs skeleton */}
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Timeline tab skeleton */}
      <div className="mb-4">
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-6 w-32 rounded-sm" />
          <Skeleton className="h-6 w-28 rounded-sm" />
          <Skeleton className="h-6 w-28 rounded-sm" />
        </div>

        {/* Timeline items skeleton */}
        {Array.from({ length: Math.min(itemCount, 100) }).map((_, i) => (
          <div key={i} className="flex mb-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="ml-3 flex-1">
              <div className="flex items-center">
                <Skeleton className="h-4 w-4 mr-3" />
                <Skeleton className={cn("h-4", getRandomWidth(), "max-w-md mr-4")} />
                <Skeleton className="h-3 w-16 flex-shrink-0 ml-auto" />
              </div>
              <div className="mt-1 pl-7">
                {Math.random() > 0.5 && <Skeleton className={cn("h-3", Math.random() > 0.7 ? "w-48" : "w-32")} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function CombinedRefresh({ isFetching, onRefresh }: { isFetching: boolean; onRefresh: () => void }) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 5));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // When a fetch completes, reset the countdown to align with the 5s interval
  useEffect(() => {
    if (!isFetching) {
      setCountdown(5);
    }
  }, [isFetching]);

  return (
    <Button
      size="sm"
      variant="outline"
      className=" px-2 border-0"
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
      <span className="ml-1 text-xs"> {countdown}s</span>
    </Button>
  );
}

interface SessionDetailsProps {
  session: GetSessionsResponse[number];
  userId?: string;
  searchQuery?: string;
}

export function SessionDetails({ session, userId, searchQuery }: SessionDetailsProps) {
  const {
    data: sessionDetailsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    dataUpdatedAt,
    isFetching,
    refetch,
  } = useGetSessionDetailsInfinite(session.session_id);
  const { site } = useParams();

  // Tick every 5s to keep relative "updated" label fresh even if data hasn't changed
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const lastUpdatedLabel = dataUpdatedAt ? DateTime.fromMillis(dataUpdatedAt).toRelative() : undefined;

  // Flatten all events into a single array
  const allEvents = useMemo(() => {
    if (!sessionDetailsData?.pages) return [];
    return sessionDetailsData.pages.flatMap(page => page.data?.events || []);
  }, [sessionDetailsData?.pages]);

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Events sorted for display based on selected order
  const displayEvents = useMemo(() => {
    const events = [...allEvents];
    events.sort((a, b) => {
      const ta = DateTime.fromSQL(a.timestamp, { zone: "utc" }).toMillis();
      const tb = DateTime.fromSQL(b.timestamp, { zone: "utc" }).toMillis();
      return sortOrder === "asc" ? ta - tb : tb - ta;
    });
    return events;
  }, [allEvents, sortOrder]);

  // Quick filter state for the top icon filters
  const [activeQuickFilter, setActiveQuickFilter] = useState<null | "products" | "cart" | "checkout" | "order">(null);
  // Marketing param quick filter (e.g., fbclid, gclid, utm_*)
  const [activeMarketingId, setActiveMarketingId] = useState<string | null>(null);

  // Visibility toggles controlled from SubHeader and persisted in localStorage (default true)
  const [showProducts, setShowProducts] = useState<boolean>(true);
  const [showCampaigns, setShowCampaigns] = useState<boolean>(true);

  useEffect(() => {
    try {
      const sp = typeof window !== 'undefined' ? localStorage.getItem('analytics.showProducts') : null;
      const sc = typeof window !== 'undefined' ? localStorage.getItem('analytics.showCampaigns') : null;
      setShowProducts(sp === null ? true : sp !== '0');
      setShowCampaigns(sc === null ? true : sc !== '0');
    } catch {}
  }, []);

  useEffect(() => {
    const applyFromStorage = () => {
      try {
        const sp = localStorage.getItem('analytics.showProducts');
        const sc = localStorage.getItem('analytics.showCampaigns');
        setShowProducts(sp === null ? true : sp !== '0');
        setShowCampaigns(sc === null ? true : sc !== '0');
      } catch {}
    };
    window.addEventListener('storage', applyFromStorage);
    window.addEventListener('analytics:visibility-toggles-update', applyFromStorage as any);
    return () => {
      window.removeEventListener('storage', applyFromStorage);
      window.removeEventListener('analytics:visibility-toggles-update', applyFromStorage as any);
    };
  }, []);

  // Apply client-side filtering for actions and pages if searchQuery is provided, then apply quick filter if selected
  const filteredEvents = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    let base = displayEvents;
    if (q) {
      base = displayEvents.filter(item => {
        const parts: string[] = [];
        if (item.type) parts.push(item.type);
        if (item.event_name) parts.push(item.event_name);
        if (item.pathname) parts.push(item.pathname);
        if (item.page_title) parts.push(item.page_title);
        if (item.querystring) parts.push(item.querystring);
        if (item.props) parts.push(JSON.stringify(item.props));
        return parts.some(p => p.toLowerCase().includes(q));
      });
    }

    // Apply quick filters (icons)
    if (activeQuickFilter) {
      base = base.filter(item => {
        switch (activeQuickFilter) {
          case "products":
            return item.type === "pageview" && typeof item.pathname === "string" && item.pathname.includes("/produs/");
          case "cart":
            return (
              item.type === "custom_event" &&
              typeof item.event_name === "string" &&
              ["addtocart", "add_to_cart", "add-to-cart"].includes(item.event_name.toLowerCase())
            );
          case "checkout":
            return item.type === "pageview" && typeof item.pathname === "string" && item.pathname.includes("/plata-cos/");
          case "order":
            return item.type === "pageview" && typeof item.pathname === "string" && item.pathname.includes("/order-received/");
          default:
            return true;
        }
      });
    }

    // Apply marketing identifier filter if active (only keep pageviews that have the selected identifier)
    if (activeMarketingId) {
      base = base.filter(item => item.type === "pageview" && extractMarketingKeysFromQuery(item.querystring || undefined).includes(activeMarketingId));
    }

    return base;
  }, [displayEvents, searchQuery, activeQuickFilter, activeMarketingId]);

  // Compute counts of marketing identifiers across the current scope (after search + quick filters, before marketing filter)
  const marketingCounts = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    let base = displayEvents;
    if (q) {
      base = displayEvents.filter(item => {
        const parts: string[] = [];
        if (item.type) parts.push(item.type);
        if (item.event_name) parts.push(item.event_name);
        if (item.pathname) parts.push(item.pathname);
        if (item.page_title) parts.push(item.page_title);
        if (item.querystring) parts.push(item.querystring);
        if (item.props) parts.push(JSON.stringify(item.props));
        return parts.some(p => p.toLowerCase().includes(q));
      });
    }
    if (activeQuickFilter) {
      base = base.filter(item => {
        switch (activeQuickFilter) {
          case "products":
            return item.type === "pageview" && typeof item.pathname === "string" && item.pathname.includes("/produs/");
          case "cart":
            return (
              item.type === "custom_event" &&
              typeof item.event_name === "string" &&
              ["addtocart", "add_to_cart", "add-to-cart"].includes(item.event_name.toLowerCase())
            );
          case "checkout":
            return item.type === "pageview" && typeof item.pathname === "string" && item.pathname.includes("/plata-cos/");
          case "order":
            return item.type === "pageview" && typeof item.pathname === "string" && item.pathname.includes("/order-received/");
          default:
            return true;
        }
      });
    }
    const counts = new Map<string, number>();
    for (const item of base) {
      if (item.type === "pageview") {
        const keys = extractMarketingKeysFromQuery(item.querystring || undefined);
        for (const k of keys) counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
    return counts;
  }, [displayEvents, searchQuery, activeQuickFilter]);

  // Get session details from the first page
  const sessionDetails = sessionDetailsData?.pages[0]?.data?.session;

  // Calculate total pageviews and events
  const totalPageviews = useMemo(() => {
    return allEvents.filter((p: SessionEvent) => p.type === "pageview").length;
  }, [allEvents]);

  const totalEvents = useMemo(() => {
    return allEvents.filter((p: SessionEvent) => p.type === "custom_event").length;
  }, [allEvents]);

  const totalErrors = useMemo(() => {
    return allEvents.filter((p: SessionEvent) => p.type === "error").length;
  }, [allEvents]);

  const totalOutbound = useMemo(() => {
    return allEvents.filter((p: SessionEvent) => p.type === "outbound").length;
  }, [allEvents]);

  // Quick status metrics
  const productPageviewsCount = useMemo(() => {
    return allEvents.filter((p: SessionEvent) => p.type === "pageview" && typeof p.pathname === "string" && p.pathname.includes("/produs/")).length;
  }, [allEvents]);

  const hasAddToCart = useMemo(() => {
    return allEvents.some(
      (p: SessionEvent) =>
        p.type === "custom_event" &&
        typeof p.event_name === "string" &&
        ["addtocart", "add_to_cart", "add-to-cart"].includes(p.event_name.toLowerCase())
    );
  }, [allEvents]);

  // Collect slugs that were added to cart during the session
  const addedToCartSlugs = useMemo(() => {
    const set = new Set<string>();
    try {
      for (const ev of allEvents as SessionEvent[]) {
        if (
          ev.type === "custom_event" &&
          typeof ev.event_name === "string" &&
          ["addtocart", "add_to_cart", "add-to-cart"].includes(ev.event_name.toLowerCase())
        ) {
          const props: any = ev.props || {};
          // 1) direct slug fields
          const directSlug: unknown = props.slug || props.product_slug || props.produs_slug;
          if (typeof directSlug === "string" && directSlug.trim()) {
            set.add(directSlug.trim());
            continue;
          }
          // 2) url fields containing /produs/{slug}
          const candidates: unknown[] = [props.url, props.href, props.link, props.product_url, props.produs_url];
          for (const c of candidates) {
            if (typeof c === "string") {
              const m = c.match(/\/produs\/([^\/?#]+)/i);
              if (m && m[1]) {
                try { set.add(decodeURIComponent(m[1])); } catch { set.add(m[1]); }
                break;
              }
            }
          }
          // 3) scan any stringy prop value for /produs/{slug}
          if (Object.keys(props).length) {
            for (const v of Object.values(props)) {
              if (typeof v === "string" && v.includes("/produs/")) {
                const m = v.match(/\/produs\/([^\/?#]+)/i);
                if (m && m[1]) {
                  try { set.add(decodeURIComponent(m[1])); } catch { set.add(m[1]); }
                }
              }
            }
          }
        }
      }
    } catch {}
    return set;
  }, [allEvents]);

  const hasCheckoutInit = useMemo(() => {
    return allEvents.some(
      (p: SessionEvent) => p.type === "pageview" && typeof p.pathname === "string" && p.pathname.includes("/plata-cos/")
    );
  }, [allEvents]);

  const hasOrderReceived = useMemo(() => {
    return allEvents.some(
      (p: SessionEvent) => p.type === "pageview" && typeof p.pathname === "string" && p.pathname.includes("/order-received/")
    );
  }, [allEvents]);

  const { getRegionName } = useGetRegionName();

  return (
    <div className="px-4 bg-neutral-900 border-t border-neutral-800">
      {isLoading ? (
        <SessionDetailsTimelineSkeleton itemCount={session.pageviews + session.events} />
      ) : error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>Error loading session details. Please try again.</AlertDescription>
        </Alert>
      ) : sessionDetailsData?.pages[0]?.data ? (
        <Tabs defaultValue="timeline" className="mt-4 relative">



            <details className="mb-6 group">
              <summary className="cursor-pointer select-none list-none px-3 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-neutral-200">
                  {/*{sessionDetails?.user_id ? (*/}
                  {/*  <span className="flex items-center gap-1 font-mono truncate max-w-[160px]" title={sessionDetails.user_id}>*/}
                  {/*    <User className="w-3 h-3 text-neutral-400" /> user: {sessionDetails.user_id.slice(0, 16)}*/}
                  {/*  </span>*/}
                  {/*) : null}*/}
                  {/*{sessionDetails?.session_id ? (*/}
                  {/*  <span className="flex items-center gap-1 font-mono truncate max-w-[200px]" title={sessionDetails.session_id}>*/}
                  {/*    <Fingerprint className="w-3 h-3 text-neutral-400" /> sid: {sessionDetails.session_id.slice(0, 20)}*/}
                  {/*  </span>*/}
                  {/*) : null}*/}
                  {sessionDetails?.ip ? (
                    <span className="flex items-center gap-1 truncate max-w-[180px]" title={sessionDetails.ip}>
                      <Globe className="w-3 h-3 text-neutral-400" /> ip: {sessionDetails.ip}
                    </span>
                  ) : null}
                  {sessionDetails?.city ? (
                    <span className="flex items-center gap-1 truncate max-w-[160px]" title={sessionDetails.city}>
                      <MapPin className="w-3 h-3 text-neutral-400" /> city: {sessionDetails.city}
                    </span>
                  ) : null}
                  {/*{sessionDetails?.device_type ? (*/}
                  {/*  <span className="flex items-center gap-1" title={sessionDetails.device_type}>*/}
                  {/*    {sessionDetails.device_type === "Desktop" && <Monitor className="w-3 h-3 text-neutral-400" />}*/}
                  {/*    {sessionDetails.device_type === "Mobile" && <Smartphone className="w-3 h-3 text-neutral-400" />}*/}
                  {/*    {sessionDetails.device_type === "Tablet" && <Tablet className="w-3 h-3 text-neutral-400" />}*/}
                  {/*    <span>device: {sessionDetails.device_type}</span>*/}
                  {/*  </span>*/}
                  {/*) : null}*/}

                </div>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 transition-transform group-open:rotate-180" />
              </summary>

              <div className=" border border-neutral-800 p-3 rounded-lg  grid grid-cols-1 lg:grid-cols-[auto_auto_auto] gap-8 mt-2">
                {/* User Information */}
                <div>
                    <h4 className="text-sm font-medium mb-3 text-neutral-300 border-b border-neutral-800 pb-2">
                        User Information
                    </h4>
                    <div className="space-y-3">
                        {sessionDetails?.user_id && (
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 bg-neutral-800 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Avatar size={24} name={sessionDetails.user_id} />
                                </div>
                                <div>
                                    <div className="text-sm text-neutral-400 flex items-center">
                                        <span className="font-medium text-neutral-300">User ID:</span>
                                        <CopyText text={sessionDetails.user_id} maxLength={24} className="inline-flex ml-2" />
                                    </div>
                                    <div className="text-sm text-neutral-400 flex items-center">
                                        <span className="font-medium text-neutral-300">Session ID:</span>
                                        <CopyText text={sessionDetails.session_id} maxLength={20} className="inline-flex ml-2" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {sessionDetails?.language && (
                                <div className="text-sm flex items-center gap-2">
                                    <span className="font-medium text-neutral-300 min-w-[80px]">Language:</span>
                                    <span className="text-neutral-400">
                          {sessionDetails.language ? getLanguageName(sessionDetails.language) : "N/A"}
                        </span>
                                </div>
                            )}

                            {sessionDetails?.country && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium text-neutral-300 min-w-[80px]">Country:</span>
                                    <div className="flex items-center gap-1 text-neutral-400">
                                        <CountryFlag country={sessionDetails.country} />
                                        <span>{getCountryName(sessionDetails.country)}</span>
                                        {sessionDetails.region && <span>({sessionDetails.region})</span>}
                                    </div>
                                </div>
                            )}
                            {sessionDetails?.region && getRegionName(sessionDetails.region) && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium text-neutral-300 min-w-[80px]">Region:</span>
                                    <span className="text-neutral-400">{getRegionName(sessionDetails.region)}</span>
                                </div>
                            )}
                            {sessionDetails?.city && (
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium text-neutral-300 min-w-[80px]">City:</span>
                                    <span className="text-neutral-400">{sessionDetails.city}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Device Information */}
                <div>
                    <h4 className="text-sm font-medium mb-3 text-neutral-300 border-b border-neutral-800 pb-2">
                        Device Information
                    </h4>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-neutral-300 min-w-[80px]">Device:</span>
                            <div className="flex items-center gap-1.5 text-neutral-400">
                                {sessionDetails?.device_type === "Desktop" && <Monitor className="w-4 h-4" />}
                                {sessionDetails?.device_type === "Mobile" && <Smartphone className="w-4 h-4" />}
                                {sessionDetails?.device_type === "Tablet" && <Tablet className="w-4 h-4" />}
                                <span>{sessionDetails?.device_type || "Unknown"}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-neutral-300 min-w-[80px]">Browser:</span>
                            <div className="flex items-center gap-1.5 text-neutral-400">
                                <Browser browser={sessionDetails?.browser || "Unknown"} />
                                <span>
                        {sessionDetails?.browser || "Unknown"}
                                    {sessionDetails?.browser_version && (
                                        <span className="ml-1">v{sessionDetails.browser_version}</span>
                                    )}
                      </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-neutral-300 min-w-[80px]">OS:</span>
                            <div className="flex items-center gap-1.5 text-neutral-400">
                                <OperatingSystem os={sessionDetails?.operating_system || ""} />
                                <span>
                        {sessionDetails?.operating_system || "Unknown"}
                                    {sessionDetails?.operating_system_version && (
                                        <span className="ml-1">{sessionDetails.operating_system_version}</span>
                                    )}
                      </span>
                            </div>
                        </div>

                        {sessionDetails?.screen_width && sessionDetails?.screen_height ? (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-neutral-300 min-w-[80px]">Screen:</span>
                                <span className="text-neutral-400">
                        {sessionDetails.screen_width} × {sessionDetails.screen_height}
                      </span>
                            </div>
                        ) : null}
                        {sessionDetails?.ip && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium text-neutral-300 min-w-[80px]">IP:</span>
                                <span className="text-neutral-400">{sessionDetails.ip}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Source Information */}
                <div className="border border-1 border-neutral-800 p-3 rounded-xl">
                    <h4 className="text-sm font-medium mb-3 text-neutral-300 border-b border-neutral-800 pb-2">
                        Source Information
                    </h4>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-neutral-300 min-w-[80px]">Channel:</span>
                            <div className="flex items-center gap-1.5 text-neutral-400">
                                <span>{sessionDetails?.channel || "None"}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-neutral-300 min-w-[80px]">Referrer:</span>
                            <div className="flex items-center gap-1.5 text-neutral-400">
                                <span>{sessionDetails?.referrer || "None"}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-neutral-300 min-w-[80px]">Entry Page:</span>
                            <div className="flex items-center gap-1.5 text-neutral-400">
                                <span>{sessionDetails?.entry_page || "None"}</span>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </details>


            <div className="mb-4 px-1 relative pt-0">

                <div className="flex justify-between items-center mb-3">


                    <div className="flex items-center gap-3 border border-1 border-green-400 ps-3 pe-3 rounded-xl pt-1 pb-1 -mt-3 filterMaster">
                      {/* Gift icon + count of visited products (pages containing /produs/) */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                          onClick={() => {
                            if (productPageviewsCount > 0) {
                              setActiveQuickFilter(prev => (prev === "products" ? null : "products"));
                            }
                          }}
                          role="button"
                          aria-pressed={activeQuickFilter === "products"}
                          className={cn(
                            "flex items-center gap-1.5 rounded px-1",
                            productPageviewsCount > 0 ? "cursor-pointer" : "cursor-default opacity-60",
                            activeQuickFilter === "products" ? "bg-white text-neutral-900" : ""
                          )}
                        >
                          <Gift className={cn(
                            "w-4 h-4",
                            activeQuickFilter === "products"
                              ? "text-neutral-900"
                              : productPageviewsCount > 0
                                ? "text-green-400"
                                : "text-neutral-500"
                          )} />
                          <Badge variant="outline" className={cn("h-5 px-1 text-neutral-200", activeQuickFilter === "products" ? "bg-white text-neutral-900 border-neutral-300" : "bg-neutral-800")}
                          >
                            {productPageviewsCount}
                          </Badge>
                        </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>Visited products (/produs/)</span>
                        </TooltipContent>
                      </Tooltip>

                      {/* Cart icon if AddToCart occurred */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => {
                              if (hasAddToCart) {
                                setActiveQuickFilter(prev => (prev === "cart" ? null : "cart"));
                              }
                            }}
                            role="button"
                            aria-pressed={activeQuickFilter === "cart"}
                            className={cn(
                              "flex items-center gap-1.5 rounded px-1",
                              hasAddToCart ? "cursor-pointer" : "cursor-default opacity-60",
                              activeQuickFilter === "cart" ? "bg-white text-neutral-900" : ""
                            )}
                          >
                            <ShoppingCart
                              className={cn(
                                "w-4 h-4",
                                activeQuickFilter === "cart"
                                  ? "text-neutral-900"
                                  : hasAddToCart
                                    ? "text-green-400"
                                    : "text-neutral-500"
                              )}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>Add to cart</span>
                        </TooltipContent>
                      </Tooltip>

                      {/* Checkout initiation if page contains /plata-cos/ */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => {
                              if (hasCheckoutInit) {
                                setActiveQuickFilter(prev => (prev === "checkout" ? null : "checkout"));
                              }
                            }}
                            role="button"
                            aria-pressed={activeQuickFilter === "checkout"}
                            className={cn(
                              "flex items-center gap-1.5 rounded px-1",
                              hasCheckoutInit ? "cursor-pointer" : "cursor-default opacity-60",
                              activeQuickFilter === "checkout" ? "bg-white text-neutral-900" : ""
                            )}
                          >
                            <CreditCard className={cn(
                              "w-4 h-4",
                              activeQuickFilter === "checkout"
                                ? "text-neutral-900"
                                : hasCheckoutInit
                                  ? "text-green-400"
                                  : "text-neutral-500"
                            )} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>Checkout started (/plata-cos/)</span>
                        </TooltipContent>
                      </Tooltip>

                      {/* Finalized if page contains /order-received/ */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => {
                              if (hasOrderReceived) {
                                setActiveQuickFilter(prev => (prev === "order" ? null : "order"));
                              }
                            }}
                            role="button"
                            aria-pressed={activeQuickFilter === "order"}
                            className={cn(
                              "flex items-center gap-1.5 rounded px-1",
                              hasOrderReceived ? "cursor-pointer" : "cursor-default opacity-60",
                              activeQuickFilter === "order" ? "bg-white text-neutral-900" : ""
                            )}
                          >
                            <CheckCircle2 className={cn(
                              "w-4 h-4",
                              activeQuickFilter === "order"
                                ? "text-neutral-900"
                                : hasOrderReceived
                                  ? "text-green-400"
                                  : "text-neutral-500"
                            )} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span>Order finalized (/order-received/)</span>
                        </TooltipContent>
                      </Tooltip>
                    </div>


                    {!userId ? (

                        <div className="flex items-center gap-2 mb-3 right-0 top-0">
                          <CombinedRefresh isFetching={isFetching} onRefresh={refetch} />

                          <span className="text-xs text-neutral-400">Sort:</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={sortOrder === "desc" ? "default" : "outline"}
                                onClick={() => setSortOrder("desc")}
                                aria-label="Newest first"
                                title="Newest first"
                              >
                                <SortDesc className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span>Newest first</span>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={sortOrder === "asc" ? "default" : "outline"}
                                onClick={() => setSortOrder("asc")}
                                aria-label="Oldest first"
                                title="Oldest first"
                              >
                                <SortAsc className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span>Oldest first</span>
                            </TooltipContent>
                          </Tooltip>
                          <Link href={`/${site}/user/${session.user_id}`}>
                                <Button size="sm" variant="success" aria-label="View User">
                                    <User className="w-4 h-4" />
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </Link>

                        </div>

                    ) : (
                        <div className="flex items-center gap-2 ">
                          <CombinedRefresh isFetching={isFetching} onRefresh={refetch} />

                          <span className="text-xs text-neutral-400">Sort:</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={sortOrder === "desc" ? "default" : "outline"}
                                onClick={() => setSortOrder("desc")}
                                aria-label="Newest first"
                                title="Newest first"
                              >
                                <SortDesc className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span>Newest first</span>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant={sortOrder === "asc" ? "default" : "outline"}
                                onClick={() => setSortOrder("asc")}
                                aria-label="Oldest first"
                                title="Oldest first"
                              >
                                <SortAsc className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span>Oldest first</span>
                            </TooltipContent>
                          </Tooltip>

                            <Link href={`/${site}/user/${session.user_id}`}>
                                <Button size="sm" variant="success" aria-label="View User">
                                    <User className="w-4 h-4" />
                                    <ArrowRight className="w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>


{/* Marketing identifiers bar (above Produse vizitate) */}
{(() => {
  if (!showCampaigns) return null;
  // Build ordered list with counts and keep only those found
  const items = MARKETING_IDENTIFIERS.map(m => ({
    key: m.identificator,
    name: m.name,
    count: marketingCounts.get(m.identificator) || 0,
  })).filter(it => it.count > 0);
  const total = items.reduce((acc, it) => acc + it.count, 0);
  if (total === 0) return null;
  return (
    <div className="mb-2 border border-neutral-800 rounded-lg p-2 bg-neutral-900">
      <div className="text-[11px] text-neutral-400 mb-1">Identified Campaign Parameters</div>
      <div className="flex items-center gap-2 flex-wrap">
        {items.map(it => (
          <button
            key={it.key}
            onClick={() => {
              if (it.count > 0) setActiveMarketingId(prev => (prev === it.key ? null : it.key));
            }}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs border",
              "cursor-pointer bg-neutral-800 border-neutral-700 hover:bg-neutral-700",
              activeMarketingId === it.key ? "bg-white text-neutral-900 border-neutral-300" : ""
            )}
            aria-pressed={activeMarketingId === it.key}
            title={it.name}
          >
            <MarketingIcon id={it.key} />
            <span className="font-mono">{it.key}</span>
            <Badge variant="outline" className={cn("h-5 px-1", activeMarketingId === it.key ? "bg-white text-neutral-900 border-neutral-300" : "bg-neutral-900 text-neutral-200")}>{it.count}</Badge>
            <span className="text-neutral-400 hidden sm:inline">{it.name}</span>
          </button>
        ))}
        {activeMarketingId && (
          <button
            onClick={() => setActiveMarketingId(null)}
            className="ml-1 text-xs underline text-neutral-300"
            title="Clear marketing filter"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
})()}

<div className="produseGasite mt-2">
  {(() => {
    if (!showProducts) return null;
    // Group product pageviews by slug from the currently displayed (filtered) events
    type Group = { count: number; indices: number[] };
    const groups = new Map<string, Group>();
    try {
      filteredEvents.forEach((ev: SessionEvent, i: number) => {
        if (ev.type === "pageview" && typeof ev.pathname === "string" && ev.pathname.includes("/produs/")) {
          const m = ev.pathname.match(/\/produs\/([^\/?#]+)/);
          if (m && m[1]) {
            try {
              const slug = decodeURIComponent(m[1]);
              const g = groups.get(slug) || { count: 0, indices: [] };
              g.count += 1;
              g.indices.push(i);
              groups.set(slug, g);
            } catch {}
          }
        }
      });
    } catch {}

    if (groups.size === 0) return null;

    // Build items array and sort by count desc (interest). For ties, keep earliest occurrence first.
    const items = Array.from(groups.entries()).map(([slug, g]) => ({ slug, count: g.count, indices: g.indices.sort((a,b)=>a-b) }));
    items.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.indices[0] - b.indices[0];
    });

    return (
      <div className="border border-1 border-neutral-800 rounded-xl p-1 bg-neutral-900 mb-3">
        <div className="flex gap-3 overflow-x-auto py-2 pr-1">
          {items.map((item) => {
            const firstIndex = item.indices[0];
            if (item.count > 1) {
              // Multiple visits: green border + count badge, no scroll on click
              const inCart = addedToCartSlugs.has(item.slug);
              return (
                <div
                  key={`${item.slug}`}
                  className={`relative shrink-0  rounded-md border-2 ${inCart ? "border-green-500" : "border-yellow-500"} cursor-default`}
                  title={`Vizitat de ${item.count} ori`}
                >

                  <div className="relative inline-block w-12 h-12">
                    <ProductBadge slug={item.slug} imageOnly />
                    {inCart && (
                      <>
                        <div className="pointer-events-none absolute inset-0 rounded bg-green-500/25" />
                        <div className="pointer-events-none absolute -top-1 -left-1 bg-green-600 text-white rounded-full p-0.5 border border-green-300">
                          <ShoppingCart className="w-3 h-3" />
                        </div>
                      </>
                    )}
                  </div>
                    <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full border border-green-300 leading-none z-0" >
                    {item.count}
                  </span>
                </div>
              );
            }
            // Single visit: clickable button that scrolls to the pageview
            return (
              <button
                key={`${item.slug}-${firstIndex}`}
                onClick={() => {
                  const el = document.getElementById(`pv-${firstIndex}`);
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className="shrink-0 bg-transparent border-0 p-0 text-left cursor-pointer"
                title={`Go to pageview #${sortOrder === "asc" ? firstIndex + 1 : filteredEvents.length - firstIndex}`}
              >
                <div className="relative inline-block w-12 h-12">
                  <ProductBadge slug={item.slug} imageOnly />
                  {addedToCartSlugs.has(item.slug) && (
                    <>
                      <div className="pointer-events-none absolute inset-0 rounded bg-green-500/25" />
                      <div className="pointer-events-none absolute -top-1 -right-1 bg-green-600 text-white rounded-full p-0.5 border border-green-300">
                        <ShoppingCart className="w-3 h-3" />
                      </div>
                    </>
                  )}
                </div>
                {/*<div className="text-[10px] text-neutral-400 mt-1 text-center">#{sortOrder === "asc" ? firstIndex + 1 : filteredEvents.length - firstIndex}</div>*/}
              </button>
            );
          })}
        </div>
      </div>
    );
  })()}
</div>

              {searchQuery && searchQuery.trim() && (
                <div className="text-xs text-neutral-400 mb-2">
                  Filtering by "{searchQuery}" — showing {filteredEvents.length} of {displayEvents.length} items
                </div>
              )}
              {filteredEvents.length === 0 && searchQuery && searchQuery.trim() ? (
                <div className="py-6 text-center text-neutral-400">No matching actions or pages</div>
              ) : null}
              {filteredEvents.map((pageview: SessionEvent, index: number) => {
                // Determine the next timestamp for duration calculation based on sort order within the filtered list
                let nextTimestamp;
                if (sortOrder === "asc") {
                  if (index < filteredEvents.length - 1) {
                    nextTimestamp = filteredEvents[index + 1].timestamp;
                  } else if (sessionDetails) {
                    nextTimestamp = sessionDetails.session_end;
                  }
                } else {
                  if (index > 0) {
                    nextTimestamp = filteredEvents[index - 1].timestamp;
                  } else if (sessionDetails) {
                    nextTimestamp = sessionDetails.session_end;
                  }
                }

                const displayNumber = sortOrder === "asc" ? index + 1 : filteredEvents.length - index;
                return (
                  <PageviewItem
                    key={`${pageview.timestamp}-${index}`}
                    item={pageview}
                    index={index}
                    isLast={index === filteredEvents.length - 1 && !hasNextPage}
                    nextTimestamp={nextTimestamp}
                    displayNumber={displayNumber}
                    anchorId={`pv-${index}`}
                    showCampaigns={showCampaigns}
                    showProducts={showProducts}
                  />
                );
              })}

              {hasNextPage && (
                <div className="flex justify-center mt-6 mb-4">
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <span>Load More</span>
                    )}
                  </Button>
                </div>
              )}

              {sessionDetailsData.pages[0]?.data?.pagination?.total > 0 && (
                <div className="text-center text-xs text-neutral-500 mt-2">
                  Showing {allEvents.length} of {sessionDetailsData.pages[0]?.data?.pagination?.total} events
                </div>
              )}
            </div>


        </Tabs>
      ) : (
        <div className="py-4 text-center text-neutral-400">No data available</div>
      )}
    </div>
  );
}


// Small component to render a product badge when a /produs/{slug} URL is detected in event props
function ProductBadge({ slug, imageOnly = false }: { slug: string; imageOnly?: boolean }) {
  const [productInfo, setProductInfo] = useState<null | {
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
  }>(null);
  const [productLoading, setProductLoading] = useState<boolean>(false);
  const [productError, setProductError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function run() {
      try {
        setProductLoading(true);
        setProductError(null);
        const data = await fetchProductInfoWithCache(slug);
        if (!aborted) setProductInfo(data);
      } catch (e: any) {
        if (!aborted) setProductError(e?.message || "Failed to load product");
      } finally {
        if (!aborted) setProductLoading(false);
      }
    }
    run();
    return () => {
      aborted = true;
    };
  }, [slug]);

  if (productLoading) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-neutral-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading product…</span>
      </span>
    );
  }

  if (productError) {
    return <span className="text-[11px] text-red-400">{productError}</span>;
  }

  if (!productInfo || !productInfo.ok) {
    return null;
  }

  // If only the image is requested (for "Produse vizitate"), render just the thumbnail
  if (imageOnly) {
    return (
      <>
        {productInfo.poza ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={productInfo.poza} alt={productInfo.nume || productInfo.slug || slug} className="w-12 h-12 object-cover rounded" />
        ) : (
          <div className="w-12 h-12 bg-neutral-800 rounded" />
        )}
      </>
    );
  }

  return (
    <div className="inline-flex items-center gap-3 p-2 border border-neutral-800 rounded-md bg-neutral-900/50">
      {productInfo.poza ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={productInfo.poza} alt={productInfo.nume || productInfo.slug || slug} className="w-10 h-10 object-cover rounded" />
      ) : (
        <div className="w-10 h-10 bg-neutral-800 rounded" />
      )}
      <div className="min-w-0">
        <div className="text-[11px] text-neutral-200 font-medium truncate max-w-[220px]" title={productInfo.nume || productInfo.slug || slug}>
          {productInfo.nume || productInfo.slug || slug}
        </div>
        <div className="text-[11px] text-neutral-300 mt-0.5 flex items-center gap-2">
          {typeof productInfo.pret_regular === "number" && productInfo.pret_redus && productInfo.pret_redus < productInfo.pret_regular ? (
            <>
              <span className="line-through text-neutral-500">{productInfo.pret_regular} RON</span>
              <span className="text-green-400 font-semibold">{productInfo.pret_redus} RON</span>
            </>
          ) : (
            <span className="text-neutral-200 font-semibold">{productInfo.pret ?? productInfo.pret_redus ?? ""} {productInfo.pret || productInfo.pret_redus ? "RON" : ""}</span>
          )}
        </div>
      </div>
    </div>
  );
}


// In-memory cache for product info by slug to avoid repeated API calls
// Cached for the lifetime of the page; only successful responses are cached.
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

  // Return from cache if present
  const cached = productCache.get(key);
  if (cached) return cached;

  // Deduplicate in-flight requests
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
  })()
    .finally(() => {
      // Clean up the in-flight marker regardless of success/failure
      productPromiseCache.delete(key);
    });

  productPromiseCache.set(key, promise);
  return promise;
}
