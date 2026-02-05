import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing YOUTUBE_API_KEY in environment." },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    regionCode: "KR",
    hl: "ko",
    key: apiKey,
  });

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videoCategories?${params.toString()}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    const message = await response.text();
    return NextResponse.json(
      { error: "YouTube API error", details: message },
      { status: response.status }
    );
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];

  const categories = items
    .map((item: { id?: string; snippet?: { title?: string } }) => ({
      value: item.id ?? "",
      label: item.snippet?.title ?? "",
    }))
    .filter((item: { value: string; label: string }) => item.value && item.label);

  return NextResponse.json({ categories });
}
