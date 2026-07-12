/**
 * Supabase client — service_role açarı ilə (yalnız server tərəfdə istifadə olunur).
 * RLS aktivdir; bütün sorğular bu client vasitəsilə keçir.
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("XƏTA: SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY .env faylında təyin olunmalıdır.");
  process.exit(1);
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
