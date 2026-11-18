import { NextResponse } from "next/server"
import { authenticate, unauthorized, forbidden } from "@/lib/auth"
import { extractStoragePath, fileUrl } from "@/lib/documents"

export const dynamic = "force-dynamic"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

type ReportFileRow = { storage_path: string; file_name: string | null }
type CompanyRef = { id: string; name: string; tin: string; email: string } | { id: string; name: string; tin: string; email: string }[] | null
type ReportRow = {
  id: string
  report_type: string
  status: string
  created_at: string
  company_id: string
  companies: CompanyRef
  report_files: ReportFileRow[] | null
}

function shapeReport(report: ReportRow) {
  const company = Array.isArray(report.companies) ? report.companies[0] : report.companies
  const files = (report.report_files ?? []).map((file) => fileUrl(file.storage_path))
  return {
    _id: report.id,
    id: report.id,
    reportType: report.report_type,
    status: STATUS_LABELS[report.status] ?? report.status,
    statusKey: report.status,
    files,
    fileNames: (report.report_files ?? []).map((file) => file.file_name),
    createdAt: report.created_at,
    companyId: company ? { _id: company.id, fullName: company.name, tinNumber: company.tin, email: company.email } : report.company_id,
  }
}

export async function GET(req: Request) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()

  // RLS narrows this to the caller's companies unless they are a platform admin.
  const { data, error } = await ctx.supabase
    .from("reports")
    .select(
      "id, report_type, status, created_at, company_id, companies (id, name, tin, email), report_files (storage_path, file_name)"
    )
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Get reports error:", error)
    return NextResponse.json({ error: "Could not load reports" }, { status: 500 })
  }

  return NextResponse.json({ reports: ((data ?? []) as unknown as ReportRow[]).map(shapeReport) })
}

export async function POST(req: Request) {
  const ctx = await authenticate(req)
  if (!ctx) return unauthorized()

  try {
    const { reportType, files, companyId, reviewNote } = await req.json()

    if (!reportType || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Report type and at least one file are required" },
        { status: 400 }
      )
    }

    const { data: membership } = await ctx.supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true })

    const targetCompanyId =
      companyId ?? (membership && membership.length > 0 ? membership[0].company_id : null)

    if (!targetCompanyId) {
      return forbidden("No company workspace is assigned to this account")
    }

    const storagePaths = files
      .map((file: string) => extractStoragePath(file))
      .filter((path: string | null): path is string => Boolean(path))

    if (storagePaths.length === 0) {
      return NextResponse.json({ error: "Upload the supporting documents first" }, { status: 400 })
    }

    const { data: report, error } = await ctx.supabase
      .from("reports")
      .insert({
        company_id: targetCompanyId,
        report_type: reportType,
        submitted_by: ctx.userId,
        review_note: reviewNote ?? null,
      })
      .select("id")
      .single()

    if (error || !report) {
      console.error("Create report error:", error)
      return NextResponse.json({ error: "Could not save the report" }, { status: 500 })
    }

    const { error: filesError } = await ctx.supabase.from("report_files").insert(
      storagePaths.map((path) => ({
        report_id: report.id,
        storage_path: path,
        file_name: path.split("/").pop() ?? null,
      }))
    )

    if (filesError) {
      console.error("Create report files error:", filesError)
      await ctx.supabase.from("reports").delete().eq("id", report.id)
      return NextResponse.json({ error: "Could not attach the documents" }, { status: 500 })
    }

    return NextResponse.json({ report: { id: report.id } }, { status: 201 })
  } catch (error) {
    console.error("Create report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
