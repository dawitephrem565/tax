import { NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { extractStoragePath } from "@/lib/documents"
import { CONFIG_ERROR, isSupabaseConfigured } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

const LEGACY_DOCUMENTS: { field: string; type: string }[] = [
  { field: "license", type: "license" },
  { field: "licenseRegistration", type: "license_registration" },
  { field: "vatCertificate", type: "vat_certificate" },
  { field: "tinCertificate", type: "tin_certificate" },
]

export async function POST(req: Request) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: CONFIG_ERROR }, { status: 503 })
  }

  const admin = createAdminSupabase()

  try {
    const body = await req.json()
    const { fullName, companyAddress, tinNumber, phone, password, files } = body
    const email = String(body.email ?? "").trim().toLowerCase()

    if (!fullName || !companyAddress || !tinNumber || !phone || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    const missingDocuments = LEGACY_DOCUMENTS.filter((doc) => !extractStoragePath(files?.[doc.field]))
    if (missingDocuments.length > 0) {
      return NextResponse.json({ error: "All documents must be uploaded" }, { status: 400 })
    }

    const { data: existing } = await admin
      .from("companies")
      .select("id, tin, email")
      .or(`tin.eq.${tinNumber},email.eq.${email}`)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          error:
            existing.tin === tinNumber
              ? "A company with this TIN already exists"
              : "Company with this email already exists",
        },
        { status: 409 }
      )
    }

    const { data: createdUser, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    })

    if (userError || !createdUser.user) {
      const duplicate = /already/i.test(userError?.message ?? "")
      return NextResponse.json(
        {
          error: duplicate
            ? "An account with this email already exists"
            : userError?.message ?? "Could not create the account",
        },
        { status: duplicate ? 409 : 400 }
      )
    }

    const userId = createdUser.user.id

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: fullName,
        tin: tinNumber,
        email,
        address: companyAddress,
        phone,
        status: "pending",
      })
      .select("id")
      .single()

    if (companyError || !company) {
      console.error("Registration company error:", companyError)
      await admin.auth.admin.deleteUser(userId).catch(() => undefined)
      return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 })
    }

    const companyId = company.id as string

    const { error: memberError } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: userId,
      role: "company_admin",
      is_primary: true,
    })

    if (memberError) {
      console.error("Registration membership error:", memberError)
      await admin.from("companies").delete().eq("id", companyId)
      await admin.auth.admin.deleteUser(userId).catch(() => undefined)
      return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 })
    }

    await admin
      .from("profiles")
      .upsert({ id: userId, full_name: fullName, email, phone }, { onConflict: "id" })

    // Move the pre-registration uploads into the company folder.
    const documentRows: Record<string, unknown>[] = []
    for (const doc of LEGACY_DOCUMENTS) {
      const sourcePath = extractStoragePath(files?.[doc.field])
      if (!sourcePath) continue
      const fileName = sourcePath.split("/").pop() || `${doc.type}.pdf`
      const targetPath = `companies/${companyId}/${doc.type}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
      const { error: moveError } = await admin.storage.from("documents").move(sourcePath, targetPath)
      documentRows.push({
        company_id: companyId,
        document_type: doc.type,
        storage_path: moveError ? sourcePath : targetPath,
        file_name: fileName,
        uploaded_by: userId,
      })
    }

    if (documentRows.length > 0) {
      const { error: docsError } = await admin.from("company_documents").insert(documentRows)
      if (docsError) console.error("Registration documents error:", docsError)
    }

    return NextResponse.json(
      { message: "Registration submitted successfully", companyId },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
