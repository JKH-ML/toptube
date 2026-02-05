import { NextRequest, NextResponse } from "next/server";

type SortKey = "views" | "likes" | "comments";
type ShortsFilter = "include" | "exclude";

type VideoItem = {
  id: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    publishedAt?: string;
    thumbnails?: {
      medium?: { url: string; width?: number; height?: number };
      high?: { url: string; width?: number; height?: number };
    };
  };
  contentDetails?: {
    duration?: string;
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

const MAX_RESULTS = 24;

function toNumber(value?: string) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIsoDuration(duration?: string) {
  if (!duration) return 0;
  const match =
    /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(duration);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY in environment." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? "KR";
  const category = searchParams.get("category") ?? "all";
  const sort = (searchParams.get("sort") ?? "views") as SortKey;
  const shorts = (searchParams.get("shorts") ?? "include") as ShortsFilter;

  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    maxResults: String(MAX_RESULTS),
    key: apiKey,
  });

  if (region !== "WORLD") {
    params.set("regionCode", region);
  }

  if (category !== "all") {
    params.set("videoCategoryId", category);
  }

  let response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    { next: { revalidate: 300 } }
  );

  const fetchByIds = async (ids: string[]) => {
    if (!ids.length) return [];
    const videoParams = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: ids.join(","),
      key: apiKey,
      maxResults: String(MAX_RESULTS),
    });
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`,
      { next: { revalidate: 300 } }
    );
    if (!videosResponse.ok) return [];
    const videosData = await videosResponse.json();
    return Array.isArray(videosData.items) ? videosData.items : [];
  };

  let data: { items?: VideoItem[] } | null = null;

  if (response.ok) {
    data = await response.json();
  } else if (response.status === 404 && category !== "all") {
    const buildSearchParams = (withRegion: boolean) => {
      const sp = new URLSearchParams({
        part: "snippet",
        type: "video",
        order: "viewCount",
        videoCategoryId: category,
        maxResults: String(MAX_RESULTS),
        key: apiKey,
        safeSearch: "none",
      });
      if (withRegion) {
        sp.set("regionCode", region);
      }
      return sp;
    };

    let searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${buildSearchParams(true).toString()}`,
      { next: { revalidate: 300 } }
    );

    if (!searchResponse.ok) {
      const message = await searchResponse.text();
      return NextResponse.json(
        { error: "YouTube API error", details: message },
        { status: searchResponse.status }
      );
    }

    let searchData = await searchResponse.json();
    let ids = Array.isArray(searchData.items)
      ? searchData.items
          .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
          .filter(Boolean)
      : [];

    if (!ids.length) {
      searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${buildSearchParams(false).toString()}`,
        { next: { revalidate: 300 } }
      );
      if (searchResponse.ok) {
        searchData = await searchResponse.json();
        ids = Array.isArray(searchData.items)
          ? searchData.items
              .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
              .filter(Boolean)
          : [];
      }
    }

    const items = await fetchByIds(ids as string[]);
    data = { items };
  } else {
    const message = await response.text();
    return NextResponse.json(
      { error: "YouTube API error", details: message },
      { status: response.status }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "YouTube API error", details: "Empty response" },
      { status: 500 }
    );
  }
  const items: VideoItem[] = Array.isArray(data.items) ? data.items : [];

  const channelIds = Array.from(
    new Set(items.map((item) => item.snippet?.channelId).filter(Boolean))
  ) as string[];

  let channelThumbnails: Record<string, string> = {};
  if (channelIds.length) {
    const channelParams = new URLSearchParams({
      part: "snippet",
      id: channelIds.join(","),
      key: apiKey,
      maxResults: "50",
    });
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
      { next: { revalidate: 300 } }
    );
    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      const channelItems = Array.isArray(channelData.items)
        ? channelData.items
        : [];
      channelThumbnails = channelItems.reduce(
        (acc: Record<string, string>, channel: { id?: string; snippet?: { thumbnails?: { default?: { url?: string }; medium?: { url?: string } } } }) => {
          if (!channel.id) return acc;
          const thumb =
            channel.snippet?.thumbnails?.medium?.url ||
            channel.snippet?.thumbnails?.default?.url ||
            "";
          if (thumb) acc[channel.id] = thumb;
          return acc;
        },
        {}
      );
    }
  }

  const sorted = [...items].sort((a, b) => {
    const aStats = a.statistics ?? {};
    const bStats = b.statistics ?? {};

    const getValue = (stats: VideoItem["statistics"]) => {
      switch (sort) {
        case "likes":
          return toNumber(stats.likeCount);
        case "comments":
          return toNumber(stats.commentCount);
        case "views":
        default:
          return toNumber(stats.viewCount);
      }
    };

    return getValue(bStats) - getValue(aStats);
  });

  const filtered =
    shorts === "exclude"
      ? sorted.filter((item) => {
          const seconds = parseIsoDuration(item.contentDetails?.duration);
          return seconds >= 60;
        })
      : sorted;

  return NextResponse.json({
    items: filtered.map((item) => ({
      id: item.id,
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      channelThumbnail: item.snippet?.channelId
        ? channelThumbnails[item.snippet.channelId] ?? ""
        : "",
      publishedAt: item.snippet?.publishedAt ?? "",
      duration: item.contentDetails?.duration ?? "",
      thumbnails: item.snippet?.thumbnails ?? {},
      statistics: item.statistics,
    })),
    fetchedAt: new Date().toISOString(),
    region,
    category,
    sort,
    shorts,
  });
}
