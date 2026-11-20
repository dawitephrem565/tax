import { NextRequest, NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { extractStoragePath } from "@/lib/documents"
import { fetchLicensesForCompany, fetchAllLicenses, addLicenseForCompany } from "@/lib/licenses"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get("companyId")

  const admin = createAdminSupabase()

  try {
    if (companyId) {
      const licenses = await fetchLicensesForCompany(admin, companyId)
      return NextResponse.json({ licenses })
    }

    const all = await fetchAllLicenses(admin)
    return NextResponse.json({ licenses: all })
  } catch (err: any) {
    return NextResponse.json({ licenses: [] })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  const admin = createAdminSupabase()

  try {
    const body = await req.json()
    const {
      company_id,
      license_name,
      license_number,
      license_type,
      company_type,
      branch_region,
      branch_office,
      documents, // array of { type, path, fileName }
    } = body

    if (!company_id || !license_name) {
      return NextResponse.json(
        { error: "Company ID and License name are required" },
        { status: 400 }
      )
    }

    const createdLicense = await addLicenseForCompany(admin, company_id, {
      license_name,
      license_number,
      license_type,
      company_type,
      branch_region,
      branch_office,
      is_primary: false,
    })

    const createdLicenseId = createdLicense.id

    // Process attached documents
    if (Array.isArray(documents) && documents.length > 0) {
      const docRows: Record<string, unknown>[] = []
      for (const d of documents) {
        const sourcePath = extractStoragePath(d.path)
        if (!sourcePath) continue
        const type = d.type || "other"
        const fileName = d.fileName || sourcePath.split("/").pop() || "document"
        const targetPath = `companies/${company_id}/${type}-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`

        const { error: moveError } = await admin.storage
          .from("documents")
          .move(sourcePath, targetPath)

        const finalPath = moveError ? sourcePath : targetPath
        const row: Record<string, unknown> = {
          company_id,
          document_type: type,
          storage_path: finalPath,
          file_name: fileName,
          uploaded_by: auth.ctx.userId,
        }
        if (createdLicenseId) row.license_id = createdLicenseId
        docRows.push(row)
      }

      if (docRows.length > 0) {
        await admin.from("company_documents").insert(docRows)
      }
    }

    return NextResponse.json(
      {
        message: "License created successfully",
        licenseId: createdLicenseId,
        license: createdLicense,
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error("Admin add license error:", err)
    return NextResponse.json({ error: err.message || "Failed to add license" }, { status: 500 })
  }
}
