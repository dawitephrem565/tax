import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/**
 * One-time bootstrap: creates the first platform admin.
 * Requires SEED_SECRET to match the x-seed-secret header, and refuses to run
 * once any platform admin exists.
 */
export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET
  if (!secret || req.headers.get("x-seed-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    return NextResponse.json(
      { error: "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD first" },
      { status: 400 }
    )
  }

  const admin = createAdminSupabase()

  const { data: existingAdmin } = await admin
    .from("profiles")
    .select("id")
    .eq("is_platform_admin", true)
    .limit(1)
    .maybeSingle()

  if (existingAdmin) {
    return NextResponse.json({ message: "A platform admin already exists" })
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Platform Admin" },
  })

  if (error || !created.user) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create the admin user" },
      { status: 400 }
    )
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { id: created.user.id, email, full_name: "Platform Admin", is_platform_admin: true },
      { onConflict: "id" }
    )

  if (profileError) {
    return NextResponse.json({ error: "Could not grant administrator access" }, { status: 500 })
  }

  return NextResponse.json(
    { message: "Platform admin created", email },
    { status: 201 }
  )
}
