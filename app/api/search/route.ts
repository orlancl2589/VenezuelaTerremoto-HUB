import { NextRequest, NextResponse } from "next/server";
import { normalize } from "@/lib/normalize";
import { scrapeVTB, scrapeVR } from "@/lib/scrapers";
import { supabase } from "@/lib/supabase";

export type PersonResult = {
  id: string;
  name: string;
  status: "missing" | "found";
  location?: string;
  age?: number;
  photoUrl?: string;
  detailUrl: string;
  platform: string;
  platformName: string;
};

export type SourceStatus = {
  platform: string;
  platformName: string;
  count: number;
  error?: string;
  fromCache?: boolean;
};

// ─── Search database ─────────────────────────────────────────────────────────
async function searchDB(query: string): Promise<PersonResult[]> {
  const terms = normalize(query)
    .split(" ")
    .filter((t) => t.length >= 2);

  if (terms.length === 0) return [];

  // AND logic: all terms must appear in name_normalized
  let dbQuery = supabase
    .from("persons")
    .select("id, name, status, location, age, photo_url, detail_url, platform, platform_name");

  for (const term of terms) {
    dbQuery = dbQuery.ilike("name_normalized", `%${term}%`);
  }

  const { data, error } = await dbQuery.limit(60);

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status as "missing" | "found",
    location: r.location ?? undefined,
    age: r.age ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    detailUrl: r.detail_url,
    platform: r.platform,
    platformName: r.platform_name,
  }));
}

// ─── Live scrape fallback ─────────────────────────────────────────────────────
// Used when the DB has no results (not yet populated) or as supplement
function isRelevant(name: string, query: string): boolean {
  const normName = normalize(name);
  const terms = normalize(query).split(" ").filter((t) => t.length >= 2);
  return terms.some((term) => normName.includes(term));
}

async function liveScrape(query: string): Promise<{ vtb: PersonResult[]; vr: PersonResult[] }> {
  const normQuery = normalize(query);
  const queries = normQuery !== query ? [query, normQuery] : [query];

  const [vtbRaw, vrRaw] = await Promise.all([
    Promise.all(queries.map((q) => scrapeVTB(q))).then((rs) => rs.flat()),
    Promise.all(queries.map((q) => scrapeVR(q))).then((rs) => rs.flat()),
  ]);

  const seen = new Set<string>();
  const dedup = (arr: PersonResult[]) =>
    arr.filter((r) => {
      const key = `${r.platform}:${normalize(r.name)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const toResult = (r: { id: string; name: string; status: string; location: string | null; age: number | null; photo_url: string | null; detail_url: string; platform: string; platform_name: string }): PersonResult => ({
    id: r.id,
    name: r.name,
    status: r.status as "missing" | "found",
    location: r.location ?? undefined,
    age: r.age ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    detailUrl: r.detail_url,
    platform: r.platform,
    platformName: r.platform_name,
  });

  return {
    vtb: dedup(vtbRaw.filter((r) => isRelevant(r.name, query)).map(toResult)),
    vr: dedup(vrRaw.filter((r) => isRelevant(r.name, query)).map(toResult)),
  };
}

// ─── Last update time ─────────────────────────────────────────────────────────
async function getLastScraped(): Promise<string | null> {
  const { data } = await supabase
    .from("scrape_logs")
    .select("ran_at")
    .order("ran_at", { ascending: false })
    .limit(1)
    .single();
  return data?.ran_at ?? null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const [dbResults, lastScraped] = await Promise.all([
    searchDB(query),
    getLastScraped(),
  ]);

  const DBThreshold = 5; // fall back to live if DB has fewer results than this
  let results = dbResults;
  let fromCache = true;
  const errors: string[] = [];

  if (dbResults.length < DBThreshold) {
    // DB not populated yet or no results — do a live scrape for this query
    fromCache = false;
    try {
      const live = await liveScrape(query);
      results = [...live.vtb, ...live.vr];
    } catch (e) {
      errors.push(String(e));
    }
  }

  // Count by platform
  const countByPlatform: Record<string, number> = {};
  for (const r of results) {
    countByPlatform[r.platform] = (countByPlatform[r.platform] ?? 0) + 1;
  }

  const sources: SourceStatus[] = [
    {
      platform: "venezuelatebusca",
      platformName: "Venezuela Te Busca",
      count: countByPlatform["venezuelatebusca"] ?? 0,
      fromCache,
    },
    {
      platform: "venezuelareporta",
      platformName: "Venezuela Reporta",
      count: countByPlatform["venezuelareporta"] ?? 0,
      fromCache,
    },
    {
      platform: "desaparecidos",
      platformName: "Desaparecidos Terremoto VE",
      count: countByPlatform["desaparecidos"] ?? 0,
      fromCache,
    },
  ];

  return NextResponse.json({ results, sources, lastScraped, fromCache });
}
