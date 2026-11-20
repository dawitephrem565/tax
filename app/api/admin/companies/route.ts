import { NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth"
import { fileUrl, LEGACY_DOCUMENT_KEYS, DOCUMENT_LABELS } from "@/lib/documents"
import { parseNotesMetadata, StoredLicense } from "@/lib/licenses"

export const dynamic = "force-dynamic"

type DocumentRow = {
  document_type: string
  storage_path: string
  file_name: string | null
}

type CompanyRow = {
  id: string
  name: string
  tin: string
  address: string | null
  phone: string | null
  email: string
  manager_phone: string | null
  notes: string | null
  status: string
  created_at: string
  business_types: { name: string } | { name: string }[] | null
  company_documents: DocumentRow[] | null
  company_members: { count: number }[] | null
}

export async function GET(req: Request) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  let query = auth.ctx.supabase
    .from("companies")
    .select(
      "id, name, tin, address, phone, email, manager_phone, notes, status, created_at, business_types (name), company_documents (document_type, storage_path, file_name), company_members (count)"
    )
    .order("created_at", { ascending: false })

  if (status && ["pending", "approved", "rejected", "suspended"].includes(status)) {
    query = query.eq("status", status)
  }

  const { data, error } = await query

  if (error) {
    console.error("Get companies error:", error)
    return NextResponse.json({ error: "Could not load companies" }, { status: 500 })
  }

  const companies = ((data ?? []) as unknown as CompanyRow[]).map((company) => {
    const businessType = Array.isArray(company.business_types)
      ? company.business_types[0]
      : company.business_types

    const files: Record<string, string> = {
      license: "",
      licenseRegistration: "",
      vatCertificate: "",
      tinCertificate: "",
    }
    const documents = (company.company_documents ?? []).map((doc) => {
      const url = fileUrl(doc.storage_path)
      const legacyKey = LEGACY_DOCUMENT_KEYS[doc.document_type]
      if (legacyKey) files[legacyKey] = url
      return {
        type: doc.document_type,
        label: DOCUMENT_LABELS[doc.document_type] ?? doc.document_type,
        name: doc.file_name,
        url,
      }
    })

    const { licenses } = parseNotesMetadata(company.notes)
    const primaryLicense: StoredLicense = {
      id: company.id,
      company_id: company.id,
      license_name: `${company.name || "Main"} License`,
      license_number: null,
      license_type: "Business License",
      is_primary: true,
      created_at: company.created_at,
    }
    const finalLicenses =
      licenses.length > 0
        ? licenses.some((l) => l.is_primary || l.id === company.id)
          ? licenses
          : [primaryLicense, ...licenses]
        : [primaryLicense]

    return {
      _id: company.id,
      id: company.id,
      fullName: company.name,
      companyAddress: company.address ?? "",
      tinNumber: company.tin,
      phone: company.phone ?? "",
      email: company.email,
      managerPhone: company.manager_phone ?? "",
      businessType: businessType?.name ?? "",
      memberCount: company.company_members?.[0]?.count ?? 0,
      status: company.status,
      files,
      documents,
      licenses: finalLicenses,
      createdAt: company.created_at,
    }
  })

  return NextResponse.json({ companies })
}
