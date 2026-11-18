import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { CONFIG_ERROR, isSupabaseConfigured } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

type CompanyRow = {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string
  tin: string
  status: string
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: CONFIG_ERROR }, { status: 503 })
  }

  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session || !data.user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from("company_members")
      .select("role, companies (id, name, address, phone, email, tin, status)")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    const company = (Array.isArray(membership?.companies)
      ? membership?.companies[0]
      : membership?.companies) as CompanyRow | null | undefined

    if (!membership || !company) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", data.user.id)
        .maybeSingle()

      if (profile?.is_platform_admin) {
        return NextResponse.json(
          { error: "This is an administrator account. Sign in at /admin-login." },
          { status: 403 }
        )
      }

      await supabase.auth.signOut()
      return NextResponse.json(
        { error: "No company workspace is assigned to this account" },
        { status: 403 }
      )
    }

    if (company.status !== "approved") {
      return NextResponse.json(
        {
          error:
            company.status === "pending"
              ? "Your account is pending approval"
              : "This company account is not active",
          status: company.status,
        },
        { status: 403 }
      )
    }

    return NextResponse.json({
      token: data.session.access_token,
      company: {
        id: company.id,
        fullName: company.name,
        email: company.email,
        companyAddress: company.address ?? "",
        tinNumber: company.tin,
        phone: company.phone ?? "",
        role: membership.role,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
