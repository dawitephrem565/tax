import { NextResponse } from "next/server"
import { authenticate, getMemberships } from "@/lib/auth"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { ACCEPTED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, fileUrl } from "@/lib/documents"

export const dynamic = "force-dynamic"

/**
 * Uploads straight into the private `documents` bucket. Vercel's filesystem is
 * read-only, so nothing is written locally; only the object path is returned.
 * Unauthenticated uploads are allowed for registration and staged under
 * `incoming/`, then moved into the company folder once the company exists.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Files must be 20 MB or smaller" }, { status: 413 })
    }

    if (file.type && !ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Upload a PDF, image, Word, Excel, CSV or text file" },
        { status: 415 }
      )
    }

    const ctx = await authenticate(req)
    let prefix = `incoming/${crypto.randomUUID()}`
    if (ctx) {
      const memberships = await getMemberships(ctx)
      if (memberships.length > 0) {
        prefix = `companies/${memberships[0].company_id}`
      }
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${prefix}/${Date.now()}-${safeName}`
    const bytes = await file.arrayBuffer()

    const admin = createAdminSupabase()
    const { error } = await admin.storage
      .from("documents")
      .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false })

    if (error) {
      console.error("Upload error:", error)
      return NextResponse.json(
        { error: error.message || "Upload failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: fileUrl(storagePath),
      path: storagePath,
      name: file.name,
      size: file.size,
    })
  } catch (error: any) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error?.message || "Upload failed" },
      { status: 500 }
    )
  }
}
