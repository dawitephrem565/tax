import { NextRequest, NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { extractStoragePath } from "@/lib/documents"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const companyId = searchParams.get("companyId")

  const admin = createAdminSupabase()

  try {
    let query = admin
      .from("company_licenses")
      .select("id, company_id, license_name, license_number, license_type, is_primary, created_at")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })

    if (companyId) {
      query = query.eq("company_id", companyId)
    }

    const { data, error } = await query

    if (error || !data) {
      return NextResponse.json({ licenses: [] })
    }

    return NextResponse.json({ licenses: data })
  } catch {
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
      documents, // array of { type, path, fileName }
    } = body

    if (!company_id || !license_name) {
      return NextResponse.json(
        { error: "Company ID and License name are required" },
        { status: 400 }
      )
    }

    let createdLicenseId: string | null = null

    try {
      const { data: lic, error: licErr } = await admin
        .from("company_licenses")
        .insert({
          company_id,
          license_name,
          license_number: license_number || null,
          license_type: license_type || "Business License",
          is_primary: false,
        })
        .select("id, license_name, license_number, license_type, is_primary")
        .single()

      if (!licErr && lic) {
        createdLicenseId = lic.id
      }
    } catch {
      // company_licenses table might not exist
    }

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
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error("Admin add license error:", err)
    return NextResponse.json({ error: err.message || "Failed to add license" }, { status: 500 })
  }
}
