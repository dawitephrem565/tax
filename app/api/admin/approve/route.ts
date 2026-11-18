import { NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { companyId, action } = await req.json()

    if (!companyId || !["approved", "rejected", "suspended"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid request. Provide companyId and action (approved/rejected)" },
        { status: 400 }
      )
    }

    const admin = createAdminSupabase()
    const { data: company, error } = await admin
      .from("companies")
      .update({
        status: action,
        approved_at: action === "approved" ? new Date().toISOString() : null,
        approved_by: action === "approved" ? auth.ctx.userId : null,
      })
      .eq("id", companyId)
      .select("id, name, tin, status")
      .maybeSingle()

    if (error) {
      console.error("Approve error:", error)
      return NextResponse.json({ error: "Could not update the company" }, { status: 500 })
    }

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: `Company ${action} successfully`,
      company: { _id: company.id, id: company.id, fullName: company.name, tinNumber: company.tin, status: company.status },
    })
  } catch (error) {
    console.error("Approve error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
