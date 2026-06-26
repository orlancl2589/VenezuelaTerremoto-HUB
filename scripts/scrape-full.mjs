/**
 * Full scraper — runs in GitHub Actions with no timeout limit.
 * Scrapes ALL pages from VR and VTB, upserts to Supabase via REST API.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const HEADERS_SCRAPE = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-VE,es;q=0.9,en;q=0.8",
};

function normalize(s) {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textContent(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────
async function upsert(records) {
  if (!records.length) return 0;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/persons`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(records),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert failed: ${res.status} — ${err}`);
  }
  return records.length;
}

async function logRun(vtb, vr, mode = "full-gh-actions") {
  await fetch(`${SUPABASE_URL}/rest/v1/scrape_logs`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ vtb_count: vtb, vr_count: vr, total_count: vtb + vr, mode }),
  });
}

// ─── Venezuela Reporta — all pages ───────────────────────────────────────────
async function scrapeVRPage(page) {
  const params = page > 1 ? `?page=${page}` : "";
  const url = `https://venezuelareporta.org/buscar${params}`;
  const res = await fetch(url, { headers: HEADERS_SCRAPE, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`VR HTTP ${res.status}`);
  const html = await res.text();

  const results = [];
  const cardRegex = /href="\/reporte\/([0-9a-f-]{36})"/g;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const uuid = match[1];
    const block = html.slice(match.index, match.index + 1500);

    const isFound = block.includes("bg-encontrado") || block.includes("Encontrado") || block.includes("A salvo");
    const nameMatch = block.match(/<h3[^>]*>([^<]+)<\/h3>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (!name) continue;

    const pMatch = block.match(/<p[^>]*class="[^"]*text-sm[^"]*text-ink-soft[^"]*"[^>]*>([^<]+)<\/p>/);
    const location = pMatch ? pMatch[1].trim() || null : null;

    const photoMatch = block.match(/<img[^>]+src="(https?:\/\/[^"]+)"[^>]*(?:alt="[^"]*")?/);

    results.push({
      id: `vr:${uuid}`,
      name,
      name_normalized: normalize(name),
      status: isFound ? "found" : "missing",
      location,
      age: null,
      photo_url: photoMatch?.[1] ?? null,
      detail_url: `https://venezuelareporta.org/reporte/${uuid}`,
      platform: "venezuelareporta",
      platform_name: "Venezuela Reporta",
    });
  }
  return results;
}

async function scrapeAllVR() {
  let total = 0;
  let page = 1;
  let consecutiveErrors = 0;
  const seenIds = new Set();

  while (true) {
    process.stdout.write(`  VR página ${page}... `);
    let records;
    try {
      records = await scrapeVRPage(page);
      consecutiveErrors = 0;
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        console.log("  5 errores consecutivos — abortando VR");
        break;
      }
      continue;
    }

    // Dedup within this run
    const fresh = records.filter(r => !seenIds.has(r.id));
    fresh.forEach(r => seenIds.add(r.id));

    if (fresh.length === 0) {
      console.log("vacía — fin");
      break;
    }

    try {
      await upsert(fresh);
      total += fresh.length;
      console.log(`${fresh.length} registros guardados (total: ${total})`);
    } catch (e) {
      console.log(`ERROR upsert: ${e.message}`);
      break;
    }

    page++;
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  return total;
}

// ─── Venezuela Te Busca — full pagination ────────────────────────────────────
async function scrapeVTBPage(page) {
  const url = page > 1
    ? `https://venezuelatebusca.com/?page=${page}`
    : `https://venezuelatebusca.com/`;
  const res = await fetch(url, { headers: HEADERS_SCRAPE, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`VTB HTTP ${res.status}`);
  const html = await res.text();

  const results = [];
  const cardRegex = /aria-label="Ver ficha de ([^"]+)"/g;
  let match;

  while ((match = cardRegex.exec(html)) !== null) {
    const name = match[1].trim();
    if (!name) continue;
    const block = html.slice(match.index, match.index + 2000);

    const photoMatch = block.match(/img src="(\/media\/photos\/([0-9a-f-]{36})\.webp)"/);
    const photoUUID = photoMatch?.[2] ?? null;
    const badgeMatch = block.match(/data-variant="([^"]+)"/);
    const isFound = badgeMatch ? badgeMatch[1] !== "destructive" : false;
    const contentMatch = block.match(/card-content[^>]*>([\s\S]{0,300}?)<\/div>/);
    const ageText = contentMatch ? textContent(contentMatch[1]) : "";
    const ageMatch = ageText.match(/(\d{1,3})\s+años/);

    results.push({
      id: `vtb:${normalize(name).replace(/\s+/g, "-")}`,
      name,
      name_normalized: normalize(name),
      status: isFound ? "found" : "missing",
      location: null,
      age: ageMatch ? parseInt(ageMatch[1]) : null,
      photo_url: photoMatch ? `https://venezuelatebusca.com${photoMatch[1]}` : null,
      detail_url: photoUUID
        ? `https://venezuelatebusca.com/?person=${photoUUID}`
        : `https://venezuelatebusca.com/?query=${encodeURIComponent(name)}`,
      platform: "venezuelatebusca",
      platform_name: "Venezuela Te Busca",
    });
  }
  return results;
}

async function scrapeAllVTB() {
  let total = 0;
  let page = 1;
  const seenIds = new Set();

  while (true) {
    process.stdout.write(`  VTB página ${page}... `);
    let records;
    try {
      records = await scrapeVTBPage(page);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      break;
    }

    // Dedup by ID within this page AND across pages (same name → same ID)
    const fresh = [];
    for (const r of records) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        fresh.push(r);
      }
    }

    if (fresh.length === 0) {
      console.log("vacía — fin");
      break;
    }

    try {
      await upsert(fresh);
      total += fresh.length;
      console.log(`${fresh.length} registros guardados (total: ${total})`);
    } catch (e) {
      console.log(`ERROR upsert: ${e.message}`);
      break;
    }

    page++;
    await new Promise(r => setTimeout(r, 400));
  }
  return total;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("ERROR: Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log("=== Scrape completo iniciado ===\n");

  // Log al inicio para que "última actualización" muestre cuándo arrancó el scraper
  await logRun(0, 0, "start");

  console.log("[ Venezuela Reporta — todas las páginas ]");
  const vrTotal = await scrapeAllVR();
  await logRun(0, vrTotal, "vr-done");

  console.log("\n[ Venezuela Te Busca — todas las páginas ]");
  const vtbTotal = await scrapeAllVTB();

  await logRun(vtbTotal, vrTotal, "full-gh-actions");

  console.log(`\n=== Finalizado: ${vtbTotal} VTB + ${vrTotal} VR = ${vtbTotal + vrTotal} total ===`);
}

main().catch(e => {
  console.error("Error fatal:", e);
  process.exit(1);
});
