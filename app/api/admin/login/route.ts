import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { CONFIG_ERROR, isSupabaseConfigured } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: CONFIG_ERROR }, { status: 503 })
  }

  try {
    const { username, password, email: emailInput } = await req.json()
    const email = emailInput ?? username

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session || !data.user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin, full_name")
      .eq("id", data.user.id)
      .maybeSingle()

    if (!profile?.is_platform_admin) {
      await supabase.auth.signOut()
      return NextResponse.json(
        { error: "This account does not have administrator access" },
        { status: 403 }
      )
    }

    return NextResponse.json({
      token: data.session.access_token,
      admin: {
        id: data.user.id,
        username: profile.full_name || data.user.email,
        email: data.user.email,
      },
    })
  } catch (error) {
    console.error("Admin login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
