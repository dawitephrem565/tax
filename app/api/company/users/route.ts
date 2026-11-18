import { NextResponse } from "next/server"
import { authenticate, unauthorized, forbidden, badRequest } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { generatePassword } from "@/lib/credentials"

export const dynamic = "force-dynamic"

const ASSIGNABLE_ROLES = ["company_admin", "accountant", "payroll_officer", "payroll_manager", "ceo"]

type MemberRow = {
  role: string
  user_id: string
  created_at: string
  profiles: { full_name: string | null; email: string | null; phone: string | null } | { full_name: string | null; email: string | null; phone: string | null }[] | null
}

async function resolveCompany(ctx: Awaited<ReturnType<typeof authenticate>>, requested?: string) {
  if (!ctx) return null
  const { data: memberships } = await ctx.supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: true })

  if (!memberships || memberships.length === 0) return null

  if (requested) {
    const match = memberships.find((row) => row.company_id === requested)
    if (!match && !ctx.isPlatformAdmin) return null
    return { companyId: requested, role: match?.role ?? "company_admin" }
  }

  return { companyId: memberships[0].company_id, role: memberships[0].role }
}

export async function GET(req: Request) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()

  const { searchParams } = new URL(req.url)
  const target = await resolveCompany(ctx, searchParams.get("companyId") ?? undefined)
  if (!target) return forbidden("No company workspace is assigned to this account")
  if (!ctx.isPlatformAdmin && target.role !== "company_admin") {
    return forbidden("Only a company admin can manage company users")
  }

  const { data, error } = await ctx.supabase
    .from("company_members")
    .select("role, user_id, created_at, profiles (full_name, email, phone)")
    .eq("company_id", target.companyId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Company users error:", error)
    return NextResponse.json({ error: "Could not load company users" }, { status: 500 })
  }

  const users = ((data ?? []) as unknown as MemberRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      userId: row.user_id,
      role: row.role,
      fullName: profile?.full_name ?? "",
      email: profile?.email ?? "",
      phone: profile?.phone ?? "",
      createdAt: row.created_at,
    }
  })

  return NextResponse.json({ users, companyId: target.companyId, currentRole: target.role })
}

export async function POST(req: Request) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()

  try {
    const body = await req.json()
    const { fullName, phone, role } = body
    const email = String(body.email ?? "").trim().toLowerCase()
    const requestedCompany = body.companyId ? String(body.companyId) : undefined

    if (!fullName || !email) return badRequest("Full name and email are required")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Enter a valid email address")
    if (role && !ASSIGNABLE_ROLES.includes(role)) return badRequest(`Unknown role: ${role}`)

    const target = await resolveCompany(ctx, requestedCompany)
    if (!target) return forbidden("No company workspace is assigned to this account")
    if (!ctx.isPlatformAdmin && target.role !== "company_admin") {
      return forbidden("Only a company admin can add company users")
    }

    const password = String(body.password ?? "").trim() || generatePassword()
    if (password.length < 8) return badRequest("Password must be at least 8 characters")

    const admin = createAdminSupabase()
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone ?? null },
    })

    if (error || !created.user) {
      const duplicate = /already/i.test(error?.message ?? "")
      return NextResponse.json(
        { error: duplicate ? "This email already has an account" : error?.message ?? "Could not create the user" },
        { status: duplicate ? 409 : 400 }
      )
    }

    const { error: memberError } = await admin.from("company_members").insert({
      company_id: target.companyId,
      user_id: created.user.id,
      role: role ?? "accountant",
    })

    if (memberError) {
      console.error("Company member error:", memberError)
      await admin.auth.admin.deleteUser(created.user.id).catch(() => undefined)
      return NextResponse.json({ error: "Could not add the user to the company" }, { status: 500 })
    }

    await admin
      .from("profiles")
      .upsert({ id: created.user.id, full_name: fullName, email, phone: phone ?? null }, { onConflict: "id" })

    return NextResponse.json(
      {
        user: { userId: created.user.id, fullName, email, role: role ?? "accountant" },
        credentials: { email, password },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Company user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
