import { createClient } from "@supabase/supabase-js"
import { serviceRoleKey, supabaseEnv } from "./env"

/**
 * Service-role client. Bypasses RLS, so it must only be used in server code
 * after the caller has been authorised, and never sent to the browser.
 * Needed for auth user provisioning and storage moves.
 */
export function createAdminSupabase() {
  const { url } = supabaseEnv()
  return createClient(url, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
