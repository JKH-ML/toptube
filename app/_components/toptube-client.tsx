"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RiArrowUpLine,
  RiArrowDownLine,
  RiChat1Line,
  RiPlayFill,
  RiRefreshLine,
  RiSettings3Line,
  RiMoonLine,
  RiSunLine,
  RiThumbUpLine,
} from "@remixicon/react";

const defaultCategories = [{ value: "all", label: "전체" }];
type Option = { value: string; label: string };

const criteria = [
  { value: "views", label: "조회수 순위" },
  { value: "likes", label: "좋아요 순위" },
  { value: "comments", label: "댓글 순위" },
];

const REGION_KR = "KR";

const periods = [
  { value: "day", label: "일간" },
  { value: "week", label: "주간" },
  { value: "month", label: "월간" },
  { value: "year", label: "연간" },
  { value: "all", label: "전체" },
];

const shortsFilters = [
  { value: "include", label: "모두 포함" },
  { value: "exclude", label: "숏폼 제외" },
];

type ApiVideo = {
  id: string;
  title: string;
  channelTitle: string;
  channelThumbnail?: string;
  publishedAt: string;
  duration?: string;
  thumbnails: {
    medium?: { url: string; width?: number; height?: number };
    high?: { url: string; width?: number; height?: number };
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

function formatNumber(value?: string) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-US");
}

function formatRelativeTime(isoDate?: string) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";

  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [30, "day"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];

  let value = seconds;
  let unit: Intl.RelativeTimeFormatUnit = "second";
  for (const [limit, nextUnit] of ranges) {
    if (value < limit) {
      unit = nextUnit;
      break;
    }
    value = Math.floor(value / limit);
  }

  const rtf = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });
  return rtf.format(-value, unit);
}

function formatDuration(isoDuration?: string) {
  if (!isoDuration) return "";
  const match = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(isoDuration);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function TopTubeClient() {
  const [categories, setCategories] = React.useState<Option[]>(defaultCategories);
  const [category, setCategory] = React.useState(defaultCategories[0].value);
  const [criterion, setCriterion] = React.useState(criteria[0].value);
  const region = REGION_KR;
  const [period, setPeriod] = React.useState(periods[0].value);
  const [shorts, setShorts] = React.useState("exclude");
  const [categoryOrder, setCategoryOrder] = React.useState<string[]>(
    defaultCategories.map((item) => item.value)
  );
  const [criterionOrder, setCriterionOrder] = React.useState<string[]>(
    criteria.map((item) => item.value)
  );
  const [videos, setVideos] = React.useState<ApiVideo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = React.useState<ApiVideo | null>(null);
  const [playerOpen, setPlayerOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);

  const fetchVideos = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      category,
      region,
      sort: criterion,
      shorts,
    });

    try {
      const response = await fetch(`/api/videos?${params.toString()}`);
      if (!response.ok) {
        let message = "요청 실패";
        try {
          const data = await response.json();
          message = data.details || data.error || message;
        } catch {
          const detail = await response.text();
          message = detail || message;
        }
        throw new Error(message);
      }

      const data = await response.json();
      const nextItems = data.items ?? [];
      setVideos(nextItems);
      setSelectedVideo((current) => {
        if (!nextItems.length) return null;
        if (!current) return nextItems[0];
        const stillExists = nextItems.some((item: ApiVideo) => item.id === current.id);
        return stillExists ? current : nextItems[0];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, [category, region, criterion, shorts]);

  const categoryLabel =
    categories.find((item) => item.value === category)?.label ?? "카테고리";
  const criterionLabel =
    criteria.find((item) => item.value === criterion)?.label ?? "기준";
  const periodLabel =
    periods.find((item) => item.value === period)?.label ?? "기간";
  const shortsLabel =
    shortsFilters.find((item) => item.value === shorts)?.label ?? "숏폼";

  const [editOrders, setEditOrders] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("toptube-category-order");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      setCategoryOrder(parsed);
    } catch {
      // ignore invalid storage
    }
  }, []);

  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (!response.ok) return;
        const data = await response.json();
        const fetched = Array.isArray(data.categories) ? data.categories : [];
        const next = [{ value: "all", label: "전체" }, ...fetched];
        setCategories(next);
        setCategory((current) =>
          next.some((item) => item.value === current) ? current : "all"
        );
        setCategoryOrder((current) => {
          const allowed = new Set(next.map((item) => item.value));
          const sanitized = current.filter((item) => allowed.has(item));
          const withMissing = [
            ...sanitized,
            ...next.map((item) => item.value).filter((item) => !sanitized.includes(item)),
          ];
          return withMissing.length ? withMissing : next.map((item) => item.value);
        });
      } catch {
        // ignore fetch errors
      }
    };
    loadCategories();
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("toptube-category-order", JSON.stringify(categoryOrder));
  }, [categoryOrder]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("toptube-criterion-order");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const allowed = new Set(criteria.map((item) => item.value));
      if (!Array.isArray(parsed)) return;
      const sanitized = parsed.filter((item: string) => allowed.has(item));
      const withMissing = [
        ...sanitized,
        ...Array.from(allowed).filter((item) => !sanitized.includes(item)),
      ];
      if (withMissing.length) setCriterionOrder(withMissing);
    } catch {
      // ignore invalid storage
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("toptube-criterion-order", JSON.stringify(criterionOrder));
  }, [criterionOrder]);

  const orderedCategories = categoryOrder
    .map((value) => categories.find((item) => item.value === value))
    .filter(Boolean) as typeof categories;
  const orderedCriteria = criterionOrder
    .map((value) => criteria.find((item) => item.value === value))
    .filter(Boolean) as typeof criteria;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("toptube-dark-mode");
    if (stored === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("toptube-dark-mode", String(darkMode));
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  React.useEffect(() => {
    if (!playerOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlayerOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playerOpen]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_oklch(0.98_0.03_190),_oklch(0.98_0.01_200)_30%,_oklch(0.99_0_0)_60%)] dark:bg-[radial-gradient(circle_at_top,_oklch(0.22_0.02_200),_oklch(0.18_0.01_220)_35%,_oklch(0.15_0_0)_70%)]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-16 pt-3">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                TopTube
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={fetchVideos} disabled={loading}>
                <RiRefreshLine /> 새로고침
              </Button>
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSettingsOpen((prev) => !prev)}
                >
                  <RiSettings3Line /> 설정
                </Button>
                {settingsOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border bg-background p-2 text-xs shadow-md">
                    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-2">
                      <span className="text-sm text-muted-foreground">다크모드</span>
                      <button
                        type="button"
                        onClick={() => setDarkMode((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {darkMode ? (
                          <>
                            <RiMoonLine className="size-3" /> 켜짐
                          </>
                        ) : (
                          <>
                            <RiSunLine className="size-3" /> 꺼짐
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Card className="border-0 bg-white/70 shadow-lg shadow-primary/10 dark:bg-card/80">
            <CardContent
              className={
                editOrders
                  ? "grid gap-5 py-5"
                  : "flex flex-wrap items-end gap-4 py-5"
              }
            >
              <div
                className={
                  editOrders
                    ? "grid w-full gap-2"
                    : "grid min-w-[180px] flex-1 gap-2"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    카테고리
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditOrders((prev) => !prev)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {editOrders ? "완료" : "순서 편집"}
                  </button>
                </div>
                {editOrders && (
                  <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
                    {orderedCategories.map((item, optionIndex) => (
                      <div
                        key={item.value}
                        className="flex items-center justify-between gap-2 py-1"
                      >
                        <span className="truncate">{item.label}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (optionIndex === 0) return;
                              const next = [...categoryOrder];
                              [next[optionIndex - 1], next[optionIndex]] = [
                                next[optionIndex],
                                next[optionIndex - 1],
                              ];
                              setCategoryOrder(next);
                            }}
                            disabled={optionIndex === 0}
                            className="text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
                            aria-label={`${item.label} 위로 이동`}
                          >
                            <RiArrowUpLine className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (optionIndex === orderedCategories.length - 1) return;
                              const next = [...categoryOrder];
                              [next[optionIndex], next[optionIndex + 1]] = [
                                next[optionIndex + 1],
                                next[optionIndex],
                              ];
                              setCategoryOrder(next);
                            }}
                            disabled={optionIndex === orderedCategories.length - 1}
                            className="text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
                            aria-label={`${item.label} 아래로 이동`}
                          >
                            <RiArrowDownLine className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="truncate">
                      {categoryLabel}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {orderedCategories.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className={
                  editOrders
                    ? "grid w-full gap-2"
                    : "grid min-w-[160px] flex-1 gap-2"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    기준
                  </span>
                </div>
                {editOrders && (
                  <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
                    {orderedCriteria.map((item, optionIndex) => (
                      <div
                        key={item.value}
                        className="flex items-center justify-between gap-2 py-1"
                      >
                        <span className="truncate">{item.label}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (optionIndex === 0) return;
                              const next = [...criterionOrder];
                              [next[optionIndex - 1], next[optionIndex]] = [
                                next[optionIndex],
                                next[optionIndex - 1],
                              ];
                              setCriterionOrder(next);
                            }}
                            disabled={optionIndex === 0}
                            className="text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
                            aria-label={`${item.label} 위로 이동`}
                          >
                            <RiArrowUpLine className="size-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (optionIndex === orderedCriteria.length - 1) return;
                              const next = [...criterionOrder];
                              [next[optionIndex], next[optionIndex + 1]] = [
                                next[optionIndex + 1],
                                next[optionIndex],
                              ];
                              setCriterionOrder(next);
                            }}
                            disabled={optionIndex === orderedCriteria.length - 1}
                            className="text-muted-foreground/70 hover:text-foreground disabled:opacity-30"
                            aria-label={`${item.label} 아래로 이동`}
                          >
                            <RiArrowDownLine className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Select value={criterion} onValueChange={setCriterion}>
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="truncate">
                      {criterionLabel}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {orderedCriteria.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className={
                  editOrders
                    ? "grid w-full gap-2"
                    : "grid min-w-[140px] flex-1 gap-2"
                }
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  기간
                </span>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="truncate">
                      {periodLabel}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className={
                  editOrders
                    ? "grid w-full gap-2"
                    : "grid min-w-[140px] flex-1 gap-2"
                }
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  숏폼
                </span>
                <Select value={shorts} onValueChange={setShorts}>
                  <SelectTrigger className="w-full">
                    <span data-slot="select-value" className="truncate">
                      {shortsLabel}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {shortsFilters.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </header>

        <section className="grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3" />

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent>
                <p className="text-sm text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {playerOpen && selectedVideo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="닫기"
                onClick={() => setPlayerOpen(false)}
              />
              <div className="relative z-10 h-full w-full bg-background shadow-xl">
                <div className="aspect-video w-full overflow-hidden bg-black">
                  <iframe
                    key={selectedVideo.id}
                    title={selectedVideo.title}
                    className="h-full w-full"
                    src={`https://www.youtube.com/embed/${selectedVideo.id}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="grid gap-1 border-t px-6 py-4">
                  <h3 className="text-base font-semibold">{selectedVideo.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedVideo.channelTitle}</p>
                  <div className="pt-2">
                    <Button size="sm" variant="outline" onClick={() => setPlayerOpen(false)}>
                      닫기
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video, index) => {
              const thumbnail =
                video.thumbnails?.high?.url ||
                video.thumbnails?.medium?.url ||
                "data:image/svg+xml;utf8," +
                  encodeURIComponent(
                    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='#0f172a'/><text x='50%' y='50%' font-size='18' fill='#e2e8f0' font-family='sans-serif' text-anchor='middle' dominant-baseline='middle'>No Thumbnail</text></svg>`
                  );
              const durationLabel = formatDuration(video.duration);
              return (
                <Card
                  key={video.id}
                  size="sm"
                  className="relative pt-0 data-[size=sm]:pt-0"
                >
                <div className="relative aspect-video overflow-hidden">
                  <Image
                    src={thumbnail}
                    alt={video.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                  {durationLabel ? (
                    <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {durationLabel}
                    </div>
                  ) : null}
                </div>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    {video.channelThumbnail ? (
                      <Image
                        src={video.channelThumbnail}
                        alt={video.channelTitle}
                        width={40}
                        height={40}
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-10 rounded-full bg-muted" />
                    )}
                    <div className="grid gap-1">
                      <CardTitle className="line-clamp-2 text-2xl">{video.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {video.channelTitle}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      조회수 {formatNumber(video.statistics?.viewCount)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <RiThumbUpLine className="size-4" />
                      {formatNumber(video.statistics?.likeCount)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <RiChat1Line className="size-4" />
                      {formatNumber(video.statistics?.commentCount)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {formatRelativeTime(video.publishedAt)}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="justify-between">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedVideo(video);
                      setPlayerOpen(true);
                    }}
                  >
                    <RiPlayFill /> 재생
                  </Button>
                  <a
                    className="text-xs text-primary underline-offset-4 hover:underline"
                    href={`https://www.youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    YouTube로 이동
                  </a>
                </CardFooter>
              </Card>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
