import { NextResponse } from "next/server"
import { authenticate, getMemberships } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const ctx = await authenticate(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const memberships = await getMemberships(ctx)
  const companyId = memberships[0]?.company_id
  if (!companyId && !ctx.isPlatformAdmin) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 403 })
  }

  const admin = createAdminSupabase()

  try {
    const { data, error } = await admin
      .from("company_licenses")
      .select("id, license_name, license_number, license_type, is_primary, created_at")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })

    if (error || !data || data.length === 0) {
      // Table may not exist yet — return a default single license
      return NextResponse.json({
        licenses: [
          {
            id: companyId,
            license_name: "Main License",
            license_number: null,
            license_type: "Business License",
            is_primary: true,
          },
        ],
      })
    }

    return NextResponse.json({ licenses: data })
  } catch {
    return NextResponse.json({
      licenses: [
        {
          id: companyId,
          license_name: "Main License",
          license_number: null,
          license_type: "Business License",
          is_primary: true,
        },
      ],
    })
  }
}

export async function POST(req: Request) {
  const ctx = await authenticate(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const memberships = await getMemberships(ctx)
  const companyId = memberships[0]?.company_id
  if (!companyId) {
    return NextResponse.json({ error: "No company associated with this account" }, { status: 403 })
  }

  const admin = createAdminSupabase()

  try {
    const body = await req.json()
    const { license_name, license_number, license_type } = body

    if (!license_name) {
      return NextResponse.json({ error: "License name is required" }, { status: 400 })
    }

    const { data, error } = await admin
      .from("company_licenses")
      .insert({
        company_id: companyId,
        license_name,
        license_number: license_number || null,
        license_type: license_type || "Business License",
        is_primary: false,
      })
      .select("id, license_name, license_number, license_type, is_primary")
      .single()

    if (error) {
      console.error("Add license error:", error)
      return NextResponse.json({ error: "Failed to add license" }, { status: 500 })
    }

    return NextResponse.json({ license: data }, { status: 201 })
  } catch (err) {
    console.error("Add license error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
