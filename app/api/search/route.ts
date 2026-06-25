import { NextRequest, NextResponse } from "next/server";

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
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
};

// Utility: extract all text nodes from an HTML snippet, stripping tags and comments
function textContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── venezuelatebusca.com ────────────────────────────────────────────────────
// Remix SSR — person data is in HTML card elements.
// Card structure:
//   <button aria-label="Ver ficha de NAME">
//     <img src="/media/photos/UUID.jpg">
//   </button>
//   <span data-variant="destructive">   ← missing (red badge)
//   <div data-slot="card-title">NAME</div>
//   <div data-slot="card-content">  AGE años - GENDER  </div>
async function searchVenezuelaTeBusca(query: string): Promise<PersonResult[]> {
  const url = `https://venezuelatebusca.com/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const results: PersonResult[] = [];

  // Find each card block anchored by aria-label
  const cardRegex = /aria-label="Ver ficha de ([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const cardStart = match.index;
    const cardBlock = html.slice(cardStart, cardStart + 2000);

    // Photo
    const photoMatch = cardBlock.match(/img src="(\/media\/photos\/[^"]+)"/);

    // Status: destructive badge = missing, outline/secondary = found
    const badgeMatch = cardBlock.match(/data-variant="([^"]+)"/);
    const isFound =
      badgeMatch && !["destructive", "outline"].includes(badgeMatch[1])
        ? false
        : badgeMatch?.[1] !== "destructive";

    // Age from card-content text: "54 años - masculino"
    const contentMatch = cardBlock.match(/card-content[^>]*>([\s\S]{0,300}?)<\/div>/);
    const ageText = contentMatch ? textContent(contentMatch[1]) : "";
    const ageMatch = ageText.match(/(\d{1,3})\s+años/);

    results.push({
      id: `vtb-${name.replace(/\s+/g, "-").toLowerCase()}-${results.length}`,
      name,
      status: isFound ? "found" : "missing",
      age: ageMatch ? parseInt(ageMatch[1]) : undefined,
      photoUrl: photoMatch
        ? `https://venezuelatebusca.com${photoMatch[1]}`
        : undefined,
      // Detail page uses client-side routing — fall back to search by name
      detailUrl: `https://venezuelatebusca.com/?q=${encodeURIComponent(name)}`,
      platform: "venezuelatebusca",
      platformName: "Venezuela Te Busca",
    });

    if (results.length >= 20) break;
  }

  return results;
}

// ─── venezuelareporta.org ────────────────────────────────────────────────────
// Next.js App Router SSR — person data is in HTML card elements.
// Card structure:
//   <a href="/reporte/UUID" class="card group...">
//     <span class="chip bg-buscando-soft">Se busca</span>  OR  bg-localizado-soft
//     <h3 class="truncate font-bold...">NAME</h3>
//     <p class="truncate text-sm text-ink-soft">AGE<!-- --> años · <!-- -->LOCATION</p>
//   </a>
async function searchVenezuelaReporta(query: string): Promise<PersonResult[]> {
  const url = `https://venezuelareporta.org/buscar?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const results: PersonResult[] = [];

  // Each card is an <a> with href="/reporte/UUID"
  const cardRegex = /href="\/reporte\/([0-9a-f-]{36})"/g;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(html)) !== null) {
    const uuid = match[1];
    const cardStart = match.index;
    const cardBlock = html.slice(cardStart, cardStart + 800);

    // Status from chip class
    const isFound = cardBlock.includes("bg-localizado") ||
      cardBlock.includes("Localizado") ||
      cardBlock.includes("A salvo");

    // Name from <h3>
    const nameMatch = cardBlock.match(/<h3[^>]*>([^<]+)<\/h3>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    // Age + location from <p>  (format: "70<!-- --> años · <!-- -->Playa grande")
    const pMatch = cardBlock.match(/<p[^>]*class="[^"]*text-ink-soft[^"]*"[^>]*>([\s\S]{0,200}?)<\/p>/);
    let age: number | undefined;
    let location: string | undefined;

    if (pMatch) {
      const pText = textContent(pMatch[1]);
      const ageM = pText.match(/(\d{1,3})\s*años/);
      age = ageM ? parseInt(ageM[1]) : undefined;
      // Location is after "· "
      const parts = pText.split("·");
      if (parts.length > 1) location = parts[1].trim();
    }

    // Photo — only present if site has one, otherwise SVG placeholder
    const photoMatch = cardBlock.match(/<img[^>]+src="(https?:\/\/[^"]+)"[^>]*alt="[^"]*"/);

    results.push({
      id: uuid,
      name,
      status: isFound ? "found" : "missing",
      age,
      location,
      photoUrl: photoMatch?.[1],
      detailUrl: `https://venezuelareporta.org/reporte/${uuid}`,
      platform: "venezuelareporta",
      platformName: "Venezuela Reporta",
    });

    if (results.length >= 20) break;
  }

  return results;
}

// ─── desaparecidosterremotovenezuela.com ─────────────────────────────────────
// Currently 0 records — included for when data is added
async function searchDesaparecidos(query: string): Promise<PersonResult[]> {
  const url = `https://desaparecidosterremotovenezuela.com/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const results: PersonResult[] = [];

  // Try generic name extraction in case they add cards
  const nameRegex = /<h[23][^>]*>([^<]{5,80})<\/h[23]>/g;
  let match: RegExpExecArray | null;
  while ((match = nameRegex.exec(html)) !== null) {
    const name = match[1].trim();
    if (name.toLowerCase().includes(query.toLowerCase().split(" ")[0])) {
      results.push({
        id: `dt-${results.length}`,
        name,
        status: "missing",
        detailUrl: `https://desaparecidosterremotovenezuela.com/?q=${encodeURIComponent(name)}`,
        platform: "desaparecidos",
        platformName: "Desaparecidos Terremoto VE",
      });
    }
    if (results.length >= 20) break;
  }

  return results;
}

// ─── Relevance filter ────────────────────────────────────────────────────────
// Source sites (especially vtb) do fuzzy search across ALL fields, returning
// results where the reporter's name or location contains the query — not the
// person's name. We filter to keep only results where the person's name
// contains at least one of the search terms.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRelevant(name: string, query: string): boolean {
  const normName = normalize(name);
  const terms = normalize(query).split(" ").filter((t) => t.length >= 2);
  return terms.some((term) => normName.includes(term));
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const [vtb, vr, dt] = await Promise.allSettled([
    searchVenezuelaTeBusca(query),
    searchVenezuelaReporta(query),
    searchDesaparecidos(query),
  ]);

  const getResults = (r: PromiseSettledResult<PersonResult[]>) =>
    r.status === "fulfilled"
      ? r.value.filter((p) => isRelevant(p.name, query))
      : [];

  const getError = (r: PromiseSettledResult<PersonResult[]>) =>
    r.status === "rejected"
      ? (r.reason as Error)?.message ?? "Error"
      : undefined;

  const allResults = [
    ...getResults(vtb),
    ...getResults(vr),
    ...getResults(dt),
  ];

  const sources: SourceStatus[] = [
    {
      platform: "venezuelatebusca",
      platformName: "Venezuela Te Busca",
      count: getResults(vtb).length,
      error: getError(vtb),
    },
    {
      platform: "venezuelareporta",
      platformName: "Venezuela Reporta",
      count: getResults(vr).length,
      error: getError(vr),
    },
    {
      platform: "desaparecidos",
      platformName: "Desaparecidos Terremoto VE",
      count: getResults(dt).length,
      error: getError(dt),
    },
  ];

  return NextResponse.json({ results: allResults, sources });
}
