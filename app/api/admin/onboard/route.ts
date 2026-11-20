import { NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { generatePassword } from "@/lib/credentials"
import { extractStoragePath } from "@/lib/documents"
import { randomUUID } from "crypto"
import { StoredLicense } from "@/lib/licenses"

export const dynamic = "force-dynamic"

type OnboardingUser = {
  fullName?: string
  email?: string
  phone?: string
  role?: string
  password?: string
}

type OnboardingDocument = {
  type?: string
  path?: string
  fileName?: string
  mimeType?: string
  fileSize?: number
  licenseId?: string
}

type OnboardingLicense = {
  licenseName?: string
  licenseNumber?: string
  licenseType?: string
  companyType?: string
  branchRegion?: string
  branchOffice?: string
  isPrimary?: boolean
  documents?: OnboardingDocument[]
}

const COMPANY_ROLES = ["company_admin", "accountant", "payroll_officer", "payroll_manager", "ceo"]
const DOCUMENT_TYPES = [
  "license",
  "license_registration",
  "vat_certificate",
  "tin_certificate",
  "trade_license_1",
  "trade_license_2",
  "vat_certificate_1",
  "vat_certificate_2",
  "neged_mezgeba",
  "neged_seyame",
  "home_rent_wel",
  "manager_national_id",
  "metedadriya_denb",
  "other",
]

/**
 * Super-admin onboarding:
 * creates the company, its license documents, multi-license records, and its first logins in one step.
 */
export async function POST(req: Request) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  const admin = createAdminSupabase()

  try {
    const body = await req.json()
    const company = body.company ?? {}
    const rawDocuments: OnboardingDocument[] = Array.isArray(body.documents) ? body.documents : []
    const users: OnboardingUser[] = Array.isArray(body.users) ? body.users : []
    const licenses: OnboardingLicense[] = Array.isArray(body.licenses) ? body.licenses : []

    const name = String(company.name ?? "").trim()
    const tin = String(company.tin ?? "").trim()
    const email = String(company.email ?? "").trim().toLowerCase()
    const address = String(company.address ?? "").trim()
    const phone = String(company.phone ?? "").trim()
    const managerPhone = String(company.managerPhone ?? "").trim()
    const companyType = company.companyType ? String(company.companyType).trim() : null
    const memberCount = company.memberCount ? Number(company.memberCount) : null
    const branchRegion = company.branchRegion ? String(company.branchRegion).trim() : null
    const branchOffice = company.branchOffice ? String(company.branchOffice).trim() : null

    if (!name || !tin || !email) {
      return NextResponse.json(
        { error: "Company name, TIN and email are required" },
        { status: 400 }
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid company email address" }, { status: 400 })
    }
    if (users.length === 0) {
      return NextResponse.json(
        { error: "Add at least one company user so the company can sign in" },
        { status: 400 }
      )
    }

    for (const user of users) {
      if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
        return NextResponse.json({ error: "Every company user needs a valid email" }, { status: 400 })
      }
      if (user.role && !COMPANY_ROLES.includes(user.role)) {
        return NextResponse.json({ error: `Unknown role: ${user.role}` }, { status: 400 })
      }
    }

    const { data: duplicate } = await admin
      .from("companies")
      .select("id, tin, email")
      .or(`tin.eq.${tin},email.eq.${email}`)
      .maybeSingle()

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            duplicate.tin === tin
              ? "A company with this TIN already exists"
              : "A company with this email already exists",
        },
        { status: 409 }
      )
    }

    const companyPayload: Record<string, unknown> = {
      name,
      tin,
      email,
      address: address || null,
      phone: phone || null,
      manager_phone: managerPhone || null,
      business_type_id: company.businessTypeId || null,
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: auth.ctx.userId,
    }

    if (companyType) companyPayload.company_type = companyType
    if (memberCount) companyPayload.member_count = memberCount
    if (branchRegion) companyPayload.branch_region = branchRegion
    if (branchOffice) companyPayload.branch_office = branchOffice

    const { data: created, error: companyError } = await admin
      .from("companies")
      .insert(companyPayload)
      .select("id, name, tin")
      .single()

    if (companyError || !created) {
      console.error("Onboarding company error:", companyError)
      return NextResponse.json({ error: "Could not create the company" }, { status: 500 })
    }

    const companyId = created.id as string

    // Process Licenses
    const createdLicenseIds: Record<string, string> = {}
    const storedLicenses: StoredLicense[] = []
    if (licenses.length > 0) {
      for (let i = 0; i < licenses.length; i++) {
        const lic = licenses[i]
        const licId = randomUUID()
        const licObj: StoredLicense = {
          id: licId,
          company_id: companyId,
          license_name: lic.licenseName || (i === 0 ? "Main License" : `License ${i + 1}`),
          license_number: lic.licenseNumber || null,
          license_type: lic.licenseType || "Business License",
          company_type: lic.companyType || companyType,
          branch_region: lic.branchRegion || branchRegion,
          branch_office: lic.branchOffice || branchOffice,
          is_primary: lic.isPrimary ?? i === 0,
          created_at: new Date().toISOString(),
        }
        storedLicenses.push(licObj)
        createdLicenseIds[`license_${i}`] = licId

        try {
          await admin.from("company_licenses").insert({
            id: licId,
            company_id: companyId,
            license_name: licObj.license_name,
            license_number: licObj.license_number,
            license_type: licObj.license_type,
            is_primary: licObj.is_primary,
          })
        } catch {
          // company_licenses table might not exist
        }
      }
    } else {
      const mainLicId = companyId
      const licObj: StoredLicense = {
        id: mainLicId,
        company_id: companyId,
        license_name: "Main License",
        license_number: null,
        license_type: "Business License",
        is_primary: true,
        created_at: new Date().toISOString(),
      }
      storedLicenses.push(licObj)
      try {
        await admin.from("company_licenses").insert({
          id: mainLicId,
          company_id: companyId,
          license_name: "Main License",
          license_number: null,
          license_type: "Business License",
          is_primary: true,
        })
      } catch {}
    }

    // Persist licenses into companies.notes
    try {
      await admin.from("companies").update({
        notes: JSON.stringify({ licenses: storedLicenses }),
      }).eq("id", companyId)
    } catch (e) {
      console.error("Failed to save licenses in company notes:", e)
    }

    // Combine flat documents and license documents
    const allDocumentsToProcess: OnboardingDocument[] = [...rawDocuments]
    licenses.forEach((lic, idx) => {
      if (Array.isArray(lic.documents)) {
        lic.documents.forEach((d) => {
          allDocumentsToProcess.push({
            ...d,
            licenseId: createdLicenseIds[`license_${idx}`],
          })
        })
      }
    })

    // Move uploaded files into the company folder, then record them.
    const documentRows: Record<string, unknown>[] = []
    for (const doc of allDocumentsToProcess) {
      const sourcePath = extractStoragePath(doc.path)
      if (!sourcePath) continue
      const type = DOCUMENT_TYPES.includes(doc.type ?? "") ? doc.type! : "other"
      const fileName = doc.fileName || sourcePath.split("/").pop() || "document"
      const targetPath = `companies/${companyId}/${type}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`

      const { error: moveError } = await admin.storage
        .from("documents")
        .move(sourcePath, targetPath)

      const finalPath = moveError ? sourcePath : targetPath
      const docRow: Record<string, unknown> = {
        company_id: companyId,
        document_type: type,
        storage_path: finalPath,
        file_name: fileName,
        mime_type: doc.mimeType ?? null,
        file_size: doc.fileSize ?? null,
        uploaded_by: auth.ctx.userId,
      }
      if (doc.licenseId) {
        docRow.license_id = doc.licenseId
      }
      documentRows.push(docRow)
    }

    if (documentRows.length > 0) {
      const { error: docsError } = await admin.from("company_documents").insert(documentRows)
      if (docsError) console.error("Onboarding documents error:", docsError)
    }

    const credentials: { fullName: string; email: string; role: string; password: string }[] = []
    const failures: { email: string; reason: string }[] = []

    for (const user of users) {
      const userEmail = String(user.email).trim().toLowerCase()
      const password = user.password?.trim() || generatePassword()
      const fullName = String(user.fullName ?? "").trim() || userEmail

      const { data: createdUser, error: userError } = await admin.auth.admin.createUser({
        email: userEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone: user.phone ?? null },
      })

      if (userError || !createdUser.user) {
        failures.push({ email: userEmail, reason: userError?.message ?? "Could not create user" })
        continue
      }

      const { error: memberError } = await admin.from("company_members").insert({
        company_id: companyId,
        user_id: createdUser.user.id,
        role: user.role ?? "accountant",
        is_primary: credentials.length === 0,
      })

      if (memberError) {
        failures.push({ email: userEmail, reason: memberError.message })
        await admin.auth.admin.deleteUser(createdUser.user.id).catch(() => undefined)
        continue
      }

      await admin
        .from("profiles")
        .upsert(
          { id: createdUser.user.id, full_name: fullName, email: userEmail, phone: user.phone ?? null },
          { onConflict: "id" }
        )

      credentials.push({
        fullName,
        email: userEmail,
        role: user.role ?? "accountant",
        password,
      })
    }

    return NextResponse.json(
      {
        message: "Company created",
        company: { id: companyId, name: created.name, tin: created.tin },
        credentials,
        failures,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
