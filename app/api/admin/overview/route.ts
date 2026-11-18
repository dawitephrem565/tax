import { NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  const supabase = auth.ctx.supabase

  try {
    const [
      companiesRes,
      pendingRes,
      approvedRes,
      rejectedRes,
      templatesRes,
      businessTypesRes,
      reportsRes,
      receiptsRes,
    ] = await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }),
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "rejected"),
      supabase.from("agreement_templates").select("id, name, state, created_at").order("name"),
      supabase.from("business_types").select("id, name, code, description, active").order("name"),
      supabase.from("reports").select("id", { count: "exact", head: true }),
      supabase.from("receipt_intakes").select("id", { count: "exact", head: true }),
    ])

    return NextResponse.json({
      stats: {
        totalCompanies: companiesRes.count ?? 0,
        pendingCompanies: pendingRes.count ?? 0,
        approvedCompanies: approvedRes.count ?? 0,
        rejectedCompanies: rejectedRes.count ?? 0,
        totalTemplates: templatesRes.data?.length ?? 0,
        totalReports: reportsRes.count ?? 0,
        totalReceipts: receiptsRes.count ?? 0,
      },
      templates: templatesRes.data ?? [],
      businessTypes: businessTypesRes.data ?? [],
    })
  } catch (error) {
    console.error("Admin overview error:", error)
    return NextResponse.json({ error: "Failed to load admin overview" }, { status: 500 })
  }
}

