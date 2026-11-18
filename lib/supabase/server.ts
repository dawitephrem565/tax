import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { supabaseEnv } from "./env"

/**
 * Cookie-bound Supabase client for route handlers and server components.
 * It uses the anon key, so every query is filtered by the RLS policies in
 * supabase/migrations/0001_init.sql.
 */
export async function createServerSupabase() {
  const { url, anonKey } = supabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a server component: middleware refreshes the session.
        }
      },
    },
  })
}
