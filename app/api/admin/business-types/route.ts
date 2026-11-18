import { NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.ctx.supabase
    .from("business_types")
    .select("id, name, code, description")
    .eq("active", true)
    .order("name")

  if (error) {
    console.error("Business types error:", error)
    return NextResponse.json({ error: "Could not load business types" }, { status: 500 })
  }

  return NextResponse.json({ businessTypes: data ?? [] })
}
