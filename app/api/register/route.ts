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

// All document slots from the new registration form
const ALL_DOCUMENT_SLOTS: { field: string; type: string }[] = [
  { field: "license", type: "license" },
  { field: "licenseRegistration", type: "license_registration" },
  { field: "vatCertificate", type: "vat_certificate" },
  { field: "tinCertificate", type: "tin_certificate" },
  { field: "negedMezgeba", type: "neged_mezgeba" },
  { field: "negedSeyame", type: "neged_seyame" },
  { field: "homeRentWel", type: "home_rent_wel" },
  { field: "managerNationalId", type: "manager_national_id" },
  { field: "metedadriyaDenb", type: "metedadriya_denb" },
]

export async function POST(req: Request) {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: CONFIG_ERROR }, { status: 503 })
  }

  const admin = createAdminSupabase()

  try {
    const body = await req.json()
    const {
      fullName,
      companyAddress,
      tinNumber,
      phone,
      password,
      companyType,
      memberCount,
      branchRegion,
      branchOffice,
      licenses,
      files, // legacy top-level files (from main license)
    } = body
    const email = String(body.email ?? "").trim().toLowerCase()

    if (!fullName || !companyAddress || !tinNumber || !phone || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    // Determine which file set to use for validation — prefer new licenses[] array
    const mainLicenseFiles = (Array.isArray(licenses) && licenses.length > 0)
      ? licenses[0].files
      : (files ?? {})

    const missingDocuments = LEGACY_DOCUMENTS.filter(
      (doc) => !extractStoragePath(mainLicenseFiles?.[doc.field])
    )
    if (missingDocuments.length > 0) {
      return NextResponse.json(
        { error: "Business License, License Registration, VAT Certificate, and TIN Certificate are required for the main license." },
        { status: 400 }
      )
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

    // Build company insert payload with new optional fields
    const companyPayload: Record<string, unknown> = {
      name: fullName,
      tin: tinNumber,
      email,
      address: companyAddress,
      phone,
      status: "pending",
    }
    if (companyType) companyPayload.company_type = companyType
    if (memberCount) companyPayload.member_count = Number(memberCount)
    if (branchRegion) companyPayload.branch_region = branchRegion
    if (branchOffice) companyPayload.branch_office = branchOffice

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert(companyPayload)
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

    // ── Process license documents ──────────────────────────────
    const documentRows: Record<string, unknown>[] = []

    // Determine license list to process
    const licenseList: Array<{
      licenseName?: string;
      licenseNumber?: string;
      licenseType?: string;
      files: Record<string, string>;
      isPrimary?: boolean;
    }> = []

    if (Array.isArray(licenses) && licenses.length > 0) {
      licenses.forEach((lic: any, idx: number) => {
        licenseList.push({ ...lic, isPrimary: idx === 0 })
      })
    } else {
      // Fallback: legacy single file set
      licenseList.push({ files: files ?? {}, isPrimary: true })
    }

    for (let licIdx = 0; licIdx < licenseList.length; licIdx++) {
      const lic = licenseList[licIdx]
      const licFiles = lic.files ?? {}

      // Optionally create a company_license record if the table exists
      let licenseId: string | null = null
      try {
        const { data: licRow } = await admin
          .from("company_licenses")
          .insert({
            company_id: companyId,
            license_name: lic.licenseName || (licIdx === 0 ? "Main License" : `License ${licIdx + 1}`),
            license_number: lic.licenseNumber || null,
            license_type: lic.licenseType || "Business License",
            is_primary: lic.isPrimary ?? licIdx === 0,
          })
          .select("id")
          .single()
        licenseId = licRow?.id ?? null
      } catch {
        // company_licenses table may not exist yet — silently skip
      }

      // Process each document slot for this license
      for (const slot of ALL_DOCUMENT_SLOTS) {
        const sourcePath = extractStoragePath(licFiles[slot.field])
        if (!sourcePath) continue

        const fileName = sourcePath.split("/").pop() || `${slot.type}.pdf`
        const targetPath = `companies/${companyId}/${slot.type}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
        const { error: moveError } = await admin.storage.from("documents").move(sourcePath, targetPath)

        const docRow: Record<string, unknown> = {
          company_id: companyId,
          document_type: slot.type,
          storage_path: moveError ? sourcePath : targetPath,
          file_name: fileName,
          uploaded_by: userId,
        }
        if (licenseId) docRow.license_id = licenseId

        documentRows.push(docRow)
      }
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
