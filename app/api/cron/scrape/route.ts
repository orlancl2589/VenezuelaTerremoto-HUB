import { NextRequest, NextResponse } from "next/server";
import { scrapeVTB, scrapeVR } from "@/lib/scrapers";
import { supabaseAdmin } from "@/lib/supabase";

// Protect the endpoint with a secret token
function isAuthorized(req: NextRequest): boolean {
  // Vercel's internal cron passes this header automatically
  if (req.headers.get("x-vercel-cron") === "1") return true;
  // External callers (GitHub Actions, manual) use Bearer token
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  return !!secret && auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("mode") ?? "recent"; // "recent" | "full"
  const pages = mode === "full" ? 10 : 2;

  let totalVTB = 0;
  let totalVR = 0;
  const errors: string[] = [];

  try {
    // Scrape VTB — no pagination support in current parser, scrape first page
    const vtbRecords = await scrapeVTB();
    if (vtbRecords.length > 0) {
      const { error } = await supabaseAdmin
        .from("persons")
        .upsert(vtbRecords, { onConflict: "id" });
      if (error) errors.push(`vtb: ${error.message}`);
      else totalVTB = vtbRecords.length;
    }
  } catch (e) {
    errors.push(`vtb: ${String(e)}`);
  }

  // Scrape VR — supports pagination
  for (let page = 1; page <= pages; page++) {
    try {
      const vrRecords = await scrapeVR("", page);
      if (vrRecords.length === 0) break;
      const { error } = await supabaseAdmin
        .from("persons")
        .upsert(vrRecords, { onConflict: "id" });
      if (error) { errors.push(`vr p${page}: ${error.message}`); break; }
      totalVR += vrRecords.length;
      if (vrRecords.length < 20) break; // last page
    } catch (e) {
      errors.push(`vr p${page}: ${String(e)}`);
      break;
    }
  }

  // Log the scrape run
  await supabaseAdmin.from("scrape_logs").insert({
    vtb_count: totalVTB,
    vr_count: totalVR,
    total_count: totalVTB + totalVR,
  });

  return NextResponse.json({
    ok: true,
    vtb: totalVTB,
    vr: totalVR,
    total: totalVTB + totalVR,
    errors,
  });
}

// Also allow GET for Vercel's cron scheduler
export async function GET(req: NextRequest) {
  return POST(req);
}
