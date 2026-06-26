import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 300; // cache 5 min on Vercel CDN

export async function GET() {
  const [totalRes, foundRes, logRes] = await Promise.all([
    supabase.from("persons").select("*", { count: "exact", head: true }),
    supabase.from("persons").select("*", { count: "exact", head: true }).eq("status", "found"),
    supabase.from("scrape_logs").select("ran_at").order("ran_at", { ascending: false }).limit(1).single(),
  ]);

  const total = totalRes.count ?? 0;
  const found = foundRes.count ?? 0;

  return NextResponse.json({
    total,
    found,
    missing: total - found,
    lastScraped: logRes.data?.ran_at ?? null,
  });
}
