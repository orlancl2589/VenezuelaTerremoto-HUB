import { normalize } from "./normalize";

export type PersonRecord = {
  id: string;
  name: string;
  name_normalized: string;
  status: "missing" | "found";
  location: string | null;
  age: number | null;
  photo_url: string | null;
  detail_url: string;
  platform: string;
  platform_name: string;
};

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
};

function textContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── venezuelatebusca.com ────────────────────────────────────────────────────
export async function scrapeVTB(query = ""): Promise<PersonRecord[]> {
  try {
    const url = query
      ? `https://venezuelatebusca.com/?q=${encodeURIComponent(query)}`
      : `https://venezuelatebusca.com/`;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const results: PersonRecord[] = [];
    const cardRegex = /aria-label="Ver ficha de ([^"]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = cardRegex.exec(html)) !== null) {
      const name = match[1].trim();
      const cardStart = match.index;
      const block = html.slice(cardStart, cardStart + 2000);

      const photoMatch = block.match(/img src="(\/media\/photos\/[^"]+)"/);
      const badgeMatch = block.match(/data-variant="([^"]+)"/);
      const isFound = badgeMatch ? badgeMatch[1] !== "destructive" : false;
      const contentMatch = block.match(/card-content[^>]*>([\s\S]{0,300}?)<\/div>/);
      const ageText = contentMatch ? textContent(contentMatch[1]) : "";
      const ageMatch = ageText.match(/(\d{1,3})\s+años/);

      results.push({
        id: `vtb:${name.replace(/\s+/g, "-").toLowerCase()}-${results.length}`,
        name,
        name_normalized: normalize(name),
        status: isFound ? "found" : "missing",
        location: null,
        age: ageMatch ? parseInt(ageMatch[1]) : null,
        photo_url: photoMatch
          ? `https://venezuelatebusca.com${photoMatch[1]}`
          : null,
        detail_url: `https://venezuelatebusca.com/?q=${encodeURIComponent(name)}`,
        platform: "venezuelatebusca",
        platform_name: "Venezuela Te Busca",
      });

      if (results.length >= 50) break;
    }
    return results;
  } catch {
    return [];
  }
}

// ─── venezuelareporta.org ────────────────────────────────────────────────────
export async function scrapeVR(query = "", page = 1): Promise<PersonRecord[]> {
  try {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (page > 1) params.set("page", String(page));
    const url = `https://venezuelareporta.org/buscar${params.size ? "?" + params : ""}`;

    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const results: PersonRecord[] = [];
    const cardRegex = /href="\/reporte\/([0-9a-f-]{36})"/g;
    let match: RegExpExecArray | null;

    while ((match = cardRegex.exec(html)) !== null) {
      const uuid = match[1];
      const block = html.slice(match.index, match.index + 800);

      const isFound =
        block.includes("bg-localizado") ||
        block.includes("Localizado") ||
        block.includes("A salvo");

      const nameMatch = block.match(/<h3[^>]*>([^<]+)<\/h3>/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();

      const pMatch = block.match(
        /<p[^>]*class="[^"]*text-ink-soft[^"]*"[^>]*>([\s\S]{0,200}?)<\/p>/
      );
      let age: number | null = null;
      let location: string | null = null;
      if (pMatch) {
        const pText = textContent(pMatch[1]);
        const ageM = pText.match(/(\d{1,3})\s*años/);
        age = ageM ? parseInt(ageM[1]) : null;
        const parts = pText.split("·");
        if (parts.length > 1) location = parts[1].trim() || null;
      }

      const photoMatch = block.match(
        /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*alt="[^"]*"/
      );

      results.push({
        id: `vr:${uuid}`,
        name,
        name_normalized: normalize(name),
        status: isFound ? "found" : "missing",
        location,
        age,
        photo_url: photoMatch?.[1] ?? null,
        detail_url: `https://venezuelareporta.org/reporte/${uuid}`,
        platform: "venezuelareporta",
        platform_name: "Venezuela Reporta",
      });

      if (results.length >= 50) break;
    }
    return results;
  } catch {
    return [];
  }
}
