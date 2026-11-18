export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export const CONFIG_ERROR =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local (and in Vercel's environment variables)."

/**
 * The dashboard's "REST URL" is often pasted as `https://<ref>.supabase.co/rest/v1/`.
 * supabase-js appends `/rest/v1` itself, so keep only the project origin.
 */
function projectUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "")
}

export function supabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const url = rawUrl ? projectUrl(rawUrl) : rawUrl
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in the Supabase project values."
    )
  }
  return { url, anonKey }
}

export function serviceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. It is only read on the server; never expose it to the browser."
    )
  }
  return key
}
