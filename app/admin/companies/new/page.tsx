"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Plus,
  Trash2,
  Upload,
  Users,
  Download,
  AlertCircle,
  Loader2,
  FileCheck2,
  ShieldAlert,
  FileText,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { toast } from "sonner"

type BusinessType = { id: string; name: string; code: string | null }
type Role = "company_admin" | "accountant" | "payroll_officer" | "payroll_manager" | "ceo"

const ROLES: { value: Role; label: string }[] = [
  { value: "company_admin", label: "Company Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "payroll_officer", label: "Payroll Officer" },
  { value: "payroll_manager", label: "Payroll Manager" },
  { value: "ceo", label: "CEO / Executive" },
]

// ── Official Branches ──────────────────────────────────────────
const ADDIS_ABABA_BRANCHES = [
  "Head Office (Mexico Square / Ras Lulseged Street, Kirkos Sub-City)",
  "Kirkos Sub-City Branch (Behind Addis Ababa Stadium)",
  "Bole Sub-City Branch (Bole Medhanealem / Dembel area)",
  "Lideta Sub-City Branch (Lideta Sub-City Administration area)",
  "Addis Ketema & Merkato Branches (Merkato commercial area / Addis Ketema Sub-City)",
  "Medium Taxpayers Branch (City-level medium taxpayers)",
  "Nifas Silk-Lafto Sub-City Branch (Near Getu Commercial Center)",
  "Gulele Sub-City Branch (Near Gulele Sub-City Administration)",
  "Yeka Sub-City Branch (Woreda 8 / near Yeka Sub-City Administration)",
  "Kolfe Keranio Sub-City Branch (Near Kolfe Keranio Sub-City Administration)",
  "Akaki Kality Sub-City Branch (Near Akaki Kality Sub-City Administration)",
  "Lemi Kura Sub-City Branch (Lemi Kura Sub-City Administration area)",
  "Woreda Micro-Taxpayer Offices (116 woreda offices across Addis Ababa)",
]

const FEDERAL_MOR_BRANCHES = [
  "MOR Headquarters (Megenagna, Bole Sub-City)",
  "Large Taxpayers Office (LTO) – Addis Ababa",
  "East Addis Ababa Medium Taxpayers Branch",
  "West Addis Ababa Medium Taxpayers Branch",
  "East Addis Ababa Small Taxpayers Branch",
  "West Addis Ababa Small Taxpayers Branch",
  "North West Addis Ababa Small Taxpayers Branch",
  "Mesob One-Stop Service Center",
  "Investment One-Stop Registration Center",
]

// ── Complete Document Slots (Including Ethiopian Statutory Files) ────
const REQUIRED_DOCUMENTS: { type: string; label: string; desc: string }[] = [
  { type: "license", label: "Business License", desc: "Commercial business trade license" },
  { type: "license_registration", label: "License Registration", desc: "Official trade registration certificate" },
  { type: "vat_certificate", label: "VAT Certificate", desc: "15% Value Added Tax certificate" },
  { type: "tin_certificate", label: "TIN Certificate", desc: "10-digit Tax Identification Number certificate" },
  { type: "neged_mezgeba", label: "Neged Mezgeba", desc: "Company commercial registration file" },
  { type: "neged_seyame", label: "Neged Seyame", desc: "Company brand name authorization file" },
  { type: "home_rent_wel", label: "Home Rent Wel", desc: "Office / commercial lease contract file" },
  { type: "manager_national_id", label: "General Manager National ID", desc: "Kebele / National Fayda ID card of GM" },
  { type: "metedadriya_denb", label: "Metedadriya Denb", desc: "Articles of association / location authorization file" },
]

interface SubLicense {
  id: string
  licenseName: string
  licenseNumber: string
  licenseType: string
  documents: Record<string, { path: string; fileName: string }>
}

type UserRow = {
  key: string
  fullName: string
  email: string
  phone: string
  role: Role
  password: string
}

type Credential = { fullName: string; email: string; role: string; password: string }

function newUserRow(role: Role = "company_admin"): UserRow {
  return { key: crypto.randomUUID(), fullName: "", email: "", phone: "", role, password: "" }
}

function newSubLicense(idx: number): SubLicense {
  return {
    id: `lic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    licenseName: `Sub-License ${idx}`,
    licenseNumber: "",
    licenseType: "Business License",
    documents: {},
  }
}

export default function OnboardCompanyPage() {
  const router = useRouter()
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  
  // Company state
  const [company, setCompany] = useState({
    name: "",
    tin: "",
    email: "",
    phone: "",
    managerPhone: "",
    address: "",
    businessTypeId: "",
    companyType: "PLC" as "PLC" | "SOLE" | "Share Company",
    memberCount: "1",
    branchRegion: "Addis Ababa" as "Addis Ababa" | "Federal",
    branchOffice: "",
  })

  // Primary License details
  const [mainLicense, setMainLicense] = useState({
    licenseName: "Main Business License",
    licenseNumber: "",
    licenseType: "Business License",
  })

  // Sub-licenses under the same company
  const [subLicenses, setSubLicenses] = useState<SubLicense[]>([])
  const [expandedLicId, setExpandedLicId] = useState<string | null>(null)

  // Document uploads for primary company
  const [documents, setDocuments] = useState<Record<string, { path: string; fileName: string }>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  
  const [users, setUsers] = useState<UserRow[]>([newUserRow()])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ credentials: Credential[]; failures: { email: string; reason: string }[] } | null>(
    null
  )

  const headers = (): Record<string, string> => {
    const token = localStorage.getItem("adminToken")
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  useEffect(() => {
    fetch("/api/admin/business-types", { headers: headers() })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.businessTypes)) setBusinessTypes(data.businessTypes)
      })
      .catch(() => undefined)
  }, [])

  const branchOptions = company.branchRegion === "Addis Ababa" ? ADDIS_ABABA_BRANCHES : FEDERAL_MOR_BRANCHES

  const updateUser = (key: string, patch: Partial<UserRow>) => {
    setUsers((prev) => prev.map((user) => (user.key === key ? { ...user, ...patch } : user)))
  }

  const uploadDocument = async (type: string, file: File, licId?: string) => {
    const uploadKey = licId ? `${licId}_${type}` : type
    setUploading(uploadKey)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", headers: headers(), body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      
      if (licId) {
        setSubLicenses((prev) =>
          prev.map((l) =>
            l.id === licId
              ? { ...l, documents: { ...l.documents, [type]: { path: data.path, fileName: file.name } } }
              : l
          )
        )
      } else {
        setDocuments((prev) => ({ ...prev, [type]: { path: data.path, fileName: file.name } }))
      }
      toast.success(`${file.name} uploaded successfully`)
    } catch (err: any) {
      setError(err.message || "Upload failed")
      toast.error(err.message || "Upload failed")
    } finally {
      setUploading(null)
    }
  }

  const handleAddSubLicense = () => {
    const lic = newSubLicense(subLicenses.length + 1)
    setSubLicenses((prev) => [...prev, lic])
    setExpandedLicId(lic.id)
    toast.info("Added new sub-license slot. Fill in license details below.")
  }

  const handleRemoveSubLicense = (id: string) => {
    setSubLicenses((prev) => prev.filter((l) => l.id !== id))
    if (expandedLicId === id) setExpandedLicId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!company.name || !company.tin || !company.email) {
      setError("Company name, TIN and email are required")
      return
    }
    if (company.companyType === "PLC" && !company.memberCount) {
      setError("Please specify the number of members for the PLC")
      return
    }
    if (!company.branchOffice) {
      setError("Please select the Gebiyon Tax Revenue Branch")
      return
    }
    if (!users.some((user) => user.email)) {
      setError("Add at least one company user with an email")
      return
    }

    setLoading(true)
    try {
      // Build licenses array (main + sub-licenses)
      const allLicensesPayload = [
        {
          licenseName: mainLicense.licenseName || "Main License",
          licenseNumber: mainLicense.licenseNumber || null,
          licenseType: mainLicense.licenseType,
          companyType: company.companyType,
          branchRegion: company.branchRegion,
          branchOffice: company.branchOffice,
          isPrimary: true,
          documents: Object.entries(documents).map(([type, doc]) => ({
            type,
            path: doc.path,
            fileName: doc.fileName,
          })),
        },
        ...subLicenses.map((lic) => ({
          licenseName: lic.licenseName,
          licenseNumber: lic.licenseNumber || null,
          licenseType: lic.licenseType,
          isPrimary: false,
          documents: Object.entries(lic.documents).map(([type, doc]) => ({
            type,
            path: doc.path,
            fileName: doc.fileName,
          })),
        })),
      ]

      const res = await fetch("/api/admin/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          company,
          licenses: allLicensesPayload,
          documents: Object.entries(documents).map(([type, doc]) => ({
            type,
            path: doc.path,
            fileName: doc.fileName,
          })),
          users: users
            .filter((user) => user.email)
            .map(({ fullName, email, phone, role, password }) => ({
              fullName,
              email,
              phone,
              role,
              password: password || undefined,
            })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not create the company")

      toast.success("Company provisioned successfully with multiple licenses in Supabase!")
      setResult({ credentials: data.credentials ?? [], failures: data.failures ?? [] })
    } catch (err: any) {
      setError(err.message || "Could not create the company")
      toast.error(err.message || "Failed to onboard company")
    } finally {
      setLoading(false)
    }
  }

  const downloadCredentials = () => {
    if (!result) return
    const rows = [
      ["Company", "Full Name", "Email", "Role", "Password"],
      ...result.credentials.map((credential) => [
        company.name,
        credential.fullName,
        credential.email,
        credential.role,
        credential.password,
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${company.name.replace(/[^a-zA-Z0-9.-]/g, "_")}-credentials.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // SUCCESS / PROVISIONED VIEW
  if (result) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Company Provisioned Successfully
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The enterprise account, licenses, and RBAC user roles have been created in Supabase.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Return to Overview
            </Button>
          </Link>
        </div>

        <Card className="border-border shadow-xs">
          <CardHeader className="p-5 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">{company.name}</CardTitle>
                <CardDescription className="text-xs font-mono">
                  TIN: {company.tin} • Type: {company.companyType} • Branch: {company.branchOffice}
                </CardDescription>
              </div>
              <Button size="sm" onClick={downloadCredentials} className="h-8 gap-1.5 text-xs shadow-xs">
                <Download className="w-3.5 h-3.5" />
                <span>Download Credentials CSV</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>User Full Name</TableHead>
                  <TableHead>Email Address</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="font-mono">Initial Password</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.credentials.map((cred, idx) => (
                  <TableRow key={idx} className="text-xs">
                    <TableCell className="font-medium">{cred.fullName}</TableCell>
                    <TableCell>{cred.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {cred.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cred.password}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>

          <CardFooter className="p-4 bg-muted/30 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldAlert className="w-4 h-4 shrink-0 text-foreground" />
            <span>
              Save these credentials now. For security, initial plaintext passwords are not stored in the database.
            </span>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // ONBOARDING FORM VIEW
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Onboard New Enterprise
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-9">
            Provision a new Ethiopian company with corporate TIN, multiple licenses, Gebiyon branch, and compliance documents.
          </p>
        </div>

        {/* Company License Option Button beside Registration */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddSubLicense}
          className="h-8 text-xs gap-1.5 border-dashed"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Company License</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3.5 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Company Profile */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-foreground" />
              <CardTitle className="text-sm font-semibold">1. Corporate Identification & Registration</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Primary entity details, legal company structure, and Ethiopian tax revenue jurisdiction.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="company-name" className="text-xs font-medium">
                  Company Legal Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company-name"
                  placeholder="e.g. Abyssinia Agro Trading PLC"
                  value={company.name}
                  onChange={(e) => setCompany((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-tin" className="text-xs font-medium">
                  Ethiopian TIN (10 digits) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company-tin"
                  placeholder="0012345678"
                  value={company.tin}
                  onChange={(e) => setCompany((prev) => ({ ...prev, tin: e.target.value }))}
                  required
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-email" className="text-xs font-medium">
                  Official Entity Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="company-email"
                  type="email"
                  placeholder="admin@company.com"
                  value={company.email}
                  onChange={(e) => setCompany((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="business-type" className="text-xs font-medium">
                  Business Sector
                </Label>
                <select
                  id="business-type"
                  value={company.businessTypeId}
                  onChange={(e) => setCompany((prev) => ({ ...prev, businessTypeId: e.target.value }))}
                  className="w-full text-xs h-8 rounded-md border border-border bg-background px-2.5 text-foreground"
                >
                  <option value="">Select Ethiopian business sector</option>
                  {businessTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} {type.code ? `(${type.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Type (PLC, SOLE, Share Company) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Company Type <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["PLC", "SOLE", "Share Company"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCompany((prev) => ({ ...prev, companyType: type }))}
                      className={`h-8 rounded-md border text-xs font-medium transition-colors ${
                        company.companyType === type
                          ? "border-primary bg-primary text-primary-foreground font-semibold"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* PLC Member Count (if PLC selected) */}
              {company.companyType === "PLC" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="member-count" className="text-xs font-medium flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Number of PLC Members (Shareholders) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="member-count"
                    type="number"
                    min="1"
                    placeholder="1 member or write number of members"
                    value={company.memberCount}
                    onChange={(e) => setCompany((prev) => ({ ...prev, memberCount: e.target.value }))}
                    className="h-8 text-xs"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="company-phone" className="text-xs font-medium">
                    Office Phone
                  </Label>
                  <Input
                    id="company-phone"
                    placeholder="+251 11 1234567"
                    value={company.phone}
                    onChange={(e) => setCompany((prev) => ({ ...prev, phone: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              {company.companyType === "PLC" && (
                <div className="space-y-1.5">
                  <Label htmlFor="company-phone" className="text-xs font-medium">
                    Office Phone
                  </Label>
                  <Input
                    id="company-phone"
                    placeholder="+251 11 1234567"
                    value={company.phone}
                    onChange={(e) => setCompany((prev) => ({ ...prev, phone: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="manager-phone" className="text-xs font-medium">
                  General Manager Direct Phone
                </Label>
                <Input
                  id="manager-phone"
                  placeholder="+251 91 1234567"
                  value={company.managerPhone}
                  onChange={(e) => setCompany((prev) => ({ ...prev, managerPhone: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="company-address" className="text-xs font-medium">
                  Registered Business Address
                </Label>
                <Input
                  id="company-address"
                  placeholder="Subcity, Woreda, Building / Office No, Addis Ababa"
                  value={company.address}
                  onChange={(e) => setCompany((prev) => ({ ...prev, address: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Gebiyon Tax Revenue Branch Selection */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 mt-2">
              <div>
                <Label className="text-xs font-semibold block">
                  Tax Revenue Branch (Gebiyon) <span className="text-destructive">*</span>
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Select the revenue authority branch where this company applies and files its tax declarations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(["Addis Ababa", "Federal"] as const).map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setCompany((prev) => ({ ...prev, branchRegion: region, branchOffice: "" }))}
                    className={`h-9 px-3 rounded-lg border text-xs font-medium transition-colors text-left flex items-center justify-between ${
                      company.branchRegion === region
                        ? "border-primary bg-primary text-primary-foreground font-semibold"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>
                      {region === "Addis Ababa"
                        ? "Addis Ababa Revenues Bureau (AARB)"
                        : "Federal Ministry of Revenue (MOR)"}
                    </span>
                    {company.branchRegion === region && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              <div className="space-y-1 mt-2">
                <Label className="text-xs font-medium">
                  Select Specific {company.branchRegion === "Addis Ababa" ? "AARB Sub-City / Head Office Branch" : "Federal MOR Branch"}
                </Label>
                <select
                  value={company.branchOffice}
                  onChange={(e) => setCompany((prev) => ({ ...prev, branchOffice: e.target.value }))}
                  className="w-full text-xs h-9 rounded-md border border-border bg-background px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">— Select official branch office —</option>
                  {branchOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Company Licenses (Multiple License Support) */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-5 border-b border-border flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-foreground" />
                <CardTitle className="text-sm font-semibold">2. Company Licenses (Main &amp; Sub-Licenses)</CardTitle>
              </div>
              <CardDescription className="text-xs">
                One enterprise can hold multiple trading licenses under the same corporate structure.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSubLicense}
              className="h-7 text-xs gap-1 border-dashed"
            >
              <Plus className="w-3 h-3" />
              Add Company License
            </Button>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Primary License Card */}
            <div className="border border-border rounded-xl p-4 bg-background space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-[10px] h-5">Main License</Badge>
                  <span className="text-xs font-semibold">{mainLicense.licenseName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">License / Trade Name</Label>
                  <Input
                    value={mainLicense.licenseName}
                    onChange={(e) => setMainLicense((prev) => ({ ...prev, licenseName: e.target.value }))}
                    placeholder="e.g. Main Commercial Trading License"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">License Number</Label>
                  <Input
                    value={mainLicense.licenseNumber}
                    onChange={(e) => setMainLicense((prev) => ({ ...prev, licenseNumber: e.target.value }))}
                    placeholder="e.g. LIC-2024-00123"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">License Type</Label>
                  <select
                    value={mainLicense.licenseType}
                    onChange={(e) => setMainLicense((prev) => ({ ...prev, licenseType: e.target.value }))}
                    className="w-full text-xs h-8 rounded-md border border-border bg-background px-2.5 text-foreground"
                  >
                    <option>Business License</option>
                    <option>Import License</option>
                    <option>Export License</option>
                    <option>Service License</option>
                    <option>Manufacturing License</option>
                    <option>Construction License</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sub-licenses List */}
            {subLicenses.map((lic, idx) => (
              <div key={lic.id} className="border border-border rounded-xl overflow-hidden bg-muted/10">
                <div
                  className="flex items-center justify-between p-3.5 bg-muted/30 cursor-pointer"
                  onClick={() => setExpandedLicId(expandedLicId === lic.id ? null : lic.id)}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5">Sub-License {idx + 1}</Badge>
                    <span className="text-xs font-semibold">{lic.licenseName || `License #${idx + 1}`}</span>
                    {lic.licenseNumber && (
                      <span className="text-[11px] font-mono text-muted-foreground">({lic.licenseNumber})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveSubLicense(lic.id)
                      }}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expandedLicId === lic.id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedLicId === lic.id && (
                  <div className="p-4 space-y-4 border-t border-border">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">License / Branch Name</Label>
                        <Input
                          value={lic.licenseName}
                          onChange={(e) =>
                            setSubLicenses((prev) =>
                              prev.map((l) => (l.id === lic.id ? { ...l, licenseName: e.target.value } : l))
                            )
                          }
                          placeholder="e.g. Retail Division / Branch 2"
                          className="h-8 text-xs bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">License Number</Label>
                        <Input
                          value={lic.licenseNumber}
                          onChange={(e) =>
                            setSubLicenses((prev) =>
                              prev.map((l) => (l.id === lic.id ? { ...l, licenseNumber: e.target.value } : l))
                            )
                          }
                          placeholder="e.g. LIC-2024-00456"
                          className="h-8 text-xs font-mono bg-background"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">License Type</Label>
                        <select
                          value={lic.licenseType}
                          onChange={(e) =>
                            setSubLicenses((prev) =>
                              prev.map((l) => (l.id === lic.id ? { ...l, licenseType: e.target.value } : l))
                            )
                          }
                          className="w-full text-xs h-8 rounded-md border border-border bg-background px-2.5 text-foreground"
                        >
                          <option>Business License</option>
                          <option>Import License</option>
                          <option>Export License</option>
                          <option>Service License</option>
                          <option>Manufacturing License</option>
                          <option>Construction License</option>
                          <option>Other</option>
                        </select>
                      </div>
                    </div>

                    {/* Sub-license documents */}
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Upload Documents for this Sub-License (Optional)
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {["license", "license_registration", "vat_certificate"].map((dType) => {
                          const docObj = lic.documents[dType]
                          const slotLabel = REQUIRED_DOCUMENTS.find((d) => d.type === dType)?.label || dType
                          return (
                            <div key={dType} className="border border-dashed border-border rounded-lg p-2.5 bg-background">
                              <span className="text-[11px] font-medium block truncate mb-1">{slotLabel}</span>
                              {docObj ? (
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span className="truncate max-w-[120px]">{docObj.fileName}</span>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                </div>
                              ) : (
                                <label className="flex items-center justify-center gap-1 text-[11px] border border-border p-1.5 rounded cursor-pointer hover:bg-muted/50 text-muted-foreground">
                                  <Upload className="w-3 h-3" />
                                  <span>{uploading === `${lic.id}_${dType}` ? "..." : "Upload"}</span>
                                  <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0]
                                      if (file) void uploadDocument(dType, file, lic.id)
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section 3: All Official Ethiopian Documents Upload */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-foreground" />
              <CardTitle className="text-sm font-semibold">3. Legal Verification &amp; Statutory Document Uploads</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Upload PDF or clear scans for Neged Mezgeba, Neged Seyame, Home Rent Wel, General Manager National ID, Metedadriya Denb, and Tax Certificates.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {REQUIRED_DOCUMENTS.map((doc) => (
                <div key={doc.type} className="border border-dashed border-border rounded-lg p-3 bg-muted/20 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold block text-foreground leading-snug">{doc.label}</span>
                    <span className="text-[10px] text-muted-foreground block line-clamp-1 mt-0.5">{doc.desc}</span>
                  </div>

                  {documents[doc.type] ? (
                    <div className="flex items-center justify-between bg-background border border-border p-1.5 rounded-md text-xs mt-2.5">
                      <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                        <FileCheck2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate text-[11px] font-medium">{documents[doc.type].fileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDocuments((prev) => {
                            const next = { ...prev }
                            delete next[doc.type]
                            return next
                          })
                        }
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-1.5 text-xs border border-border bg-background hover:bg-muted/60 p-2 rounded-md cursor-pointer transition-colors mt-2.5 text-muted-foreground hover:text-foreground">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploading === doc.type ? "Uploading..." : "Select File"}</span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void uploadDocument(doc.type, file)
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Company Users & RBAC */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-5 border-b border-border flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-foreground" />
                <CardTitle className="text-sm font-semibold">4. Company Team &amp; Role Provisioning</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Creates initial login credentials with role-based access for this company.
              </CardDescription>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setUsers((prev) => [...prev, newUserRow("accountant")])}
              className="h-7 text-xs gap-1 border-border"
            >
              <Plus className="w-3 h-3" />
              Add User
            </Button>
          </CardHeader>

          <CardContent className="p-5 space-y-3">
            {users.map((user, idx) => (
              <div key={user.key} className="grid grid-cols-1 md:grid-cols-5 gap-2.5 p-3 rounded-lg border border-border bg-muted/10 items-center">
                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-1">Full Name</Label>
                  <Input
                    placeholder="e.g. Abebe Bekele"
                    value={user.fullName}
                    onChange={(e) => updateUser(user.key, { fullName: e.target.value })}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-1">Email (Login ID)</Label>
                  <Input
                    placeholder="user@company.com"
                    type="email"
                    value={user.email}
                    onChange={(e) => updateUser(user.key, { email: e.target.value })}
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-1">Phone</Label>
                  <Input
                    placeholder="+251 91 1234567"
                    value={user.phone}
                    onChange={(e) => updateUser(user.key, { phone: e.target.value })}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-1">Role</Label>
                  <select
                    value={user.role}
                    onChange={(e) => updateUser(user.key, { role: e.target.value as Role })}
                    className="w-full text-xs h-8 rounded-md border border-border bg-background px-2 text-foreground"
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 pt-4">
                  <Input
                    placeholder="Auto-generated"
                    type="text"
                    value={user.password}
                    onChange={(e) => updateUser(user.key, { password: e.target.value })}
                    className="h-8 text-xs font-mono bg-background"
                  />
                  {users.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUsers((prev) => prev.filter((u) => u.key !== user.key))}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/admin">
            <Button type="button" variant="outline" size="sm" className="h-9 text-xs">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading} size="sm" className="h-9 text-xs shadow-xs px-6">
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Provisioning Company &amp; Licenses...
              </>
            ) : (
              "Complete Enterprise Registration"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
