import { NextResponse } from "next/server"
import { authenticate } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const COMPANY_PATH = /^companies\/([0-9a-fA-F-]{36})\//

/**
 * Authorises a document read and redirects to a short-lived signed URL.
 * Works for <a href> and <img src> because it relies on the session cookie;
 * API callers can pass the bearer token instead.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get("path")

  if (!path || path.includes("..")) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
  }

  const ctx = await authenticate(req)
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let allowed = ctx.isPlatformAdmin

  if (!allowed) {
    const match = COMPANY_PATH.exec(path)
    if (match) {
      const { data } = await ctx.supabase
        .from("company_members")
        .select("id")
        .eq("company_id", match[1])
        .eq("user_id", ctx.userId)
        .maybeSingle()
      allowed = Boolean(data)
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminSupabase()
  const { data, error } = await admin.storage.from("documents").createSignedUrl(path, 60 * 10)

  if (error || !data?.signedUrl) {
    console.error("Sign URL error:", error)
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
