import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { createServerSupabase } from "@/lib/supabase/server"
import { supabaseEnv } from "@/lib/supabase/env"

export type AuthContext = {
  userId: string
  email: string | null
  /** RLS-bound client: all reads/writes are filtered by company membership. */
  supabase: SupabaseClient
  isPlatformAdmin: boolean
}

/**
 * Accepts either the Supabase session cookie or `Authorization: Bearer <access_token>`.
 * The token form keeps the existing browser code (localStorage) working unchanged.
 */
export async function authenticate(req: Request): Promise<AuthContext | null> {
  const header = req.headers.get("authorization")

  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim()
    if (token && token !== "undefined" && token !== "null") {
      try {
        const { url, anonKey } = supabaseEnv()
        const supabase = createClient(url, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { data, error } = await supabase.auth.getUser(token)
        if (!error && data?.user) {
          return {
            userId: data.user.id,
            email: data.user.email ?? null,
            supabase,
            isPlatformAdmin: await readIsPlatformAdmin(supabase, data.user.id),
          }
        }
      } catch (err) {
        console.warn("Bearer token verification error:", err)
      }
    }
  }

  // Fallback to cookie-based Supabase session
  try {
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      return {
        userId: data.user.id,
        email: data.user.email ?? null,
        supabase,
        isPlatformAdmin: await readIsPlatformAdmin(supabase, data.user.id),
      }
    }
  } catch (err) {
    console.warn("Cookie session verification error:", err)
  }

  return null
}

async function readIsPlatformAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle()
  return Boolean(data?.is_platform_admin)
}

export type RequireAdminResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }

export async function requirePlatformAdmin(req: Request): Promise<RequireAdminResult> {
  const ctx = await authenticate(req)
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  if (!ctx.isPlatformAdmin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true, ctx }
}

export type Membership = {
  company_id: string
  role: "company_admin" | "accountant" | "payroll_officer" | "payroll_manager" | "ceo"
  company: { id: string; name: string; tin: string; status: string } | null
}

export async function getMemberships(ctx: AuthContext): Promise<Membership[]> {
  const { data } = await ctx.supabase
    .from("company_members")
    .select("company_id, role, companies (id, name, tin, status)")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: true })

  return (data ?? []).map((row) => {
    const company = Array.isArray(row.companies) ? row.companies[0] : row.companies
    return {
      company_id: row.company_id,
      role: row.role,
      company: company
        ? { id: company.id, name: company.name, tin: company.tin, status: company.status }
        : null,
    }
  })
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ error: message }, { status: 500 })
}
