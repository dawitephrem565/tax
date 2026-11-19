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

/**
 * Company admins CANNOT add licenses.
 * Only the Platform Super Admin can provision or add licenses.
 */
export async function POST(req: Request) {
  const ctx = await authenticate(req)
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!ctx.isPlatformAdmin) {
    return NextResponse.json(
      {
        error: "Permission Denied: Company administrators cannot add licenses. Only the Super Administrator can add and provision enterprise licenses.",
      },
      { status: 403 }
    )
  }

  return NextResponse.json(
    { error: "Use /api/admin/licenses to add licenses as Super Admin." },
    { status: 400 }
  )
}
