import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public client — used for searches (anon read-only)
export const supabase = createClient(url, anon);

// Service client — used by the scraper to write data (never exposed to browser)
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false },
});
