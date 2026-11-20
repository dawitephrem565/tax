import { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"

export interface StoredLicense {
  id: string
  company_id: string
  license_name: string
  license_number: string | null
  license_type: string
  is_primary: boolean
  company_type?: string | null
  branch_region?: string | null
  branch_office?: string | null
  created_at: string
}

interface CompanyNotesMetadata {
  notesText?: string
  licenses?: StoredLicense[]
  [key: string]: any
}

export function parseNotesMetadata(notes: string | null | undefined): { notesText: string; licenses: StoredLicense[] } {
  if (!notes) return { notesText: "", licenses: [] }
  try {
    const parsed = JSON.parse(notes)
    if (parsed && typeof parsed === "object") {
      const licenses = Array.isArray(parsed.licenses) ? parsed.licenses : []
      const notesText = typeof parsed.notesText === "string" ? parsed.notesText : ""
      return { notesText, licenses }
    }
  } catch {
    // notes is just a raw string
    return { notesText: notes, licenses: [] }
  }
  return { notesText: "", licenses: [] }
}

export async function fetchLicensesForCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<StoredLicense[]> {
  // 1. Try querying company_licenses table if it exists
  try {
    const { data: tableData, error: tableErr } = await admin
      .from("company_licenses")
      .select("id, company_id, license_name, license_number, license_type, is_primary, created_at")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })

    if (!tableErr && tableData && tableData.length > 0) {
      return tableData
    }
  } catch {
    // table doesn't exist
  }

  // 2. Query company record and retrieve licenses from notes metadata
  try {
    const { data: comp } = await admin
      .from("companies")
      .select("id, name, notes, created_at")
      .eq("id", companyId)
      .single()

    if (comp) {
      const { licenses } = parseNotesMetadata(comp.notes)
      const primaryLicense: StoredLicense = {
        id: comp.id,
        company_id: comp.id,
        license_name: `${comp.name || "Main"} License`,
        license_number: null,
        license_type: "Business License",
        is_primary: true,
        created_at: comp.created_at || new Date().toISOString(),
      }

      if (licenses.length === 0) {
        return [primaryLicense]
      }

      // Check if primary is in licenses array
      const hasPrimary = licenses.some((l) => l.is_primary || l.id === comp.id)
      if (!hasPrimary) {
        return [primaryLicense, ...licenses]
      }
      return licenses
    }
  } catch (e) {
    console.error("fetchLicensesForCompany error:", e)
  }

  return [
    {
      id: companyId,
      company_id: companyId,
      license_name: "Main License",
      license_number: null,
      license_type: "Business License",
      is_primary: true,
      created_at: new Date().toISOString(),
    },
  ]
}

export async function fetchAllLicenses(admin: SupabaseClient): Promise<StoredLicense[]> {
  // 1. Try company_licenses table
  try {
    const { data: tableData, error: tableErr } = await admin
      .from("company_licenses")
      .select("id, company_id, license_name, license_number, license_type, is_primary, created_at")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })

    if (!tableErr && tableData && tableData.length > 0) {
      return tableData
    }
  } catch {
    // table doesn't exist
  }

  // 2. Extract from companies notes
  try {
    const { data: companies } = await admin.from("companies").select("id, name, notes, created_at")
    const all: StoredLicense[] = []
    for (const comp of companies || []) {
      const { licenses } = parseNotesMetadata(comp.notes)
      if (licenses.length > 0) {
        const hasPrimary = licenses.some((l) => l.is_primary || l.id === comp.id)
        if (!hasPrimary) {
          all.push({
            id: comp.id,
            company_id: comp.id,
            license_name: `${comp.name || "Main"} License`,
            license_number: null,
            license_type: "Business License",
            is_primary: true,
            created_at: comp.created_at || new Date().toISOString(),
          })
        }
        all.push(...licenses)
      } else {
        all.push({
          id: comp.id,
          company_id: comp.id,
          license_name: `${comp.name || "Main"} License`,
          license_number: null,
          license_type: "Business License",
          is_primary: true,
          created_at: comp.created_at || new Date().toISOString(),
        })
      }
    }
    return all
  } catch (e) {
    console.error("fetchAllLicenses error:", e)
    return []
  }
}

export async function addLicenseForCompany(
  admin: SupabaseClient,
  companyId: string,
  licenseInput: {
    license_name: string
    license_number?: string | null
    license_type?: string
    company_type?: string | null
    branch_region?: string | null
    branch_office?: string | null
    is_primary?: boolean
  }
): Promise<StoredLicense> {
  const newLicId = randomUUID()
  const newLicense: StoredLicense = {
    id: newLicId,
    company_id: companyId,
    license_name: licenseInput.license_name,
    license_number: licenseInput.license_number || null,
    license_type: licenseInput.license_type || "Business License",
    company_type: licenseInput.company_type || null,
    branch_region: licenseInput.branch_region || null,
    branch_office: licenseInput.branch_office || null,
    is_primary: Boolean(licenseInput.is_primary),
    created_at: new Date().toISOString(),
  }

  // 1. Try inserting into company_licenses table
  try {
    const { data: inserted, error: licErr } = await admin
      .from("company_licenses")
      .insert({
        id: newLicId,
        company_id: companyId,
        license_name: newLicense.license_name,
        license_number: newLicense.license_number,
        license_type: newLicense.license_type,
        is_primary: newLicense.is_primary,
      })
      .select()
      .single()

    if (!licErr && inserted?.id) {
      newLicense.id = inserted.id
    }
  } catch {
    // company_licenses table does not exist
  }

  // 2. Guaranteed persistence in companies.notes
  try {
    const { data: comp } = await admin
      .from("companies")
      .select("id, name, notes, created_at")
      .eq("id", companyId)
      .single()

    if (comp) {
      const { notesText, licenses: existing } = parseNotesMetadata(comp.notes)
      const hasPrimary = existing.some((l) => l.is_primary || l.id === comp.id)
      const listToSave = hasPrimary
        ? [...existing, newLicense]
        : [
            {
              id: comp.id,
              company_id: comp.id,
              license_name: `${comp.name || "Main"} License`,
              license_number: null,
              license_type: "Business License",
              is_primary: true,
              created_at: comp.created_at || new Date().toISOString(),
            },
            ...existing,
            newLicense,
          ]

      const updatedMeta: CompanyNotesMetadata = {
        notesText,
        licenses: listToSave,
      }

      await admin
        .from("companies")
        .update({
          notes: JSON.stringify(updatedMeta),
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId)
    }
  } catch (err) {
    console.error("Failed to persist license in company notes:", err)
  }

  return newLicense
}
