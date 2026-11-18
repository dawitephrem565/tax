"use client"

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
  ShieldAlert
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

const DOCUMENTS: { type: string; label: string }[] = [
  { type: "license", label: "Business License" },
  { type: "license_registration", label: "License Registration" },
  { type: "vat_certificate", label: "VAT Certificate" },
  { type: "tin_certificate", label: "TIN Certificate" },
]

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

export default function OnboardCompanyPage() {
  const router = useRouter()
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([])
  const [company, setCompany] = useState({
    name: "",
    tin: "",
    email: "",
    phone: "",
    managerPhone: "",
    address: "",
    businessTypeId: "",
  })
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

  const updateUser = (key: string, patch: Partial<UserRow>) => {
    setUsers((prev) => prev.map((user) => (user.key === key ? { ...user, ...patch } : user)))
  }

  const uploadDocument = async (type: string, file: File) => {
    setUploading(type)
    setError("")
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", headers: headers(), body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      setDocuments((prev) => ({ ...prev, [type]: { path: data.path, fileName: file.name } }))
      toast.success(`${file.name} uploaded successfully`)
    } catch (err: any) {
      setError(err.message || "Upload failed")
      toast.error(err.message || "Upload failed")
    } finally {
      setUploading(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!company.name || !company.tin || !company.email) {
      setError("Company name, TIN and email are required")
      return
    }
    if (!users.some((user) => user.email)) {
      setError("Add at least one company user with an email")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          company,
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

      toast.success("Company provisioned successfully in Supabase!")
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

  // SUCCESS / PROVISIONED VIEW (inside admin layout container)
  if (result) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-foreground" />
              Company Provisioned Successfully
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The enterprise account and RBAC user roles have been created in Supabase.
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
                <CardDescription className="text-xs font-mono">TIN: {company.tin}</CardDescription>
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

  // ONBOARDING FORM VIEW (inside admin layout container)
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
            Provision a new Ethiopian company with corporate TIN, legal license verification, and team RBAC roles.
          </p>
        </div>
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
              <CardTitle className="text-sm font-semibold">1. Corporate Identification</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Primary entity details and Ethiopian business registration.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="company-name" className="text-xs font-medium">
                  Company Name <span className="text-destructive">*</span>
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
                  placeholder="admin@abyssinia.com"
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

              <div className="space-y-1.5">
                <Label htmlFor="manager-phone" className="text-xs font-medium">
                  Manager Direct Phone
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
          </CardContent>
        </Card>

        {/* Section 2: Verification Documents */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-foreground" />
              <CardTitle className="text-sm font-semibold">2. Legal Verification Documents</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Upload PDF or image files (up to 20 MB each) for compliance archival in Supabase Storage.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOCUMENTS.map((doc) => (
                <div key={doc.type} className="border border-dashed border-border rounded-lg p-3.5 bg-muted/20">
                  <span className="text-xs font-medium block text-foreground mb-1">{doc.label}</span>

                  {documents[doc.type] ? (
                    <div className="flex items-center justify-between bg-background border border-border p-2 rounded-md text-xs mt-2">
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <FileCheck2 className="w-3.5 h-3.5 text-foreground shrink-0" />
                        <span className="truncate text-[11px]">{documents[doc.type].fileName}</span>
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
                    <label className="flex items-center justify-center gap-2 text-xs border border-border bg-background hover:bg-muted/60 p-2 rounded-md cursor-pointer transition-colors mt-2 text-muted-foreground hover:text-foreground">
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

        {/* Section 3: Company Users & RBAC */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-5 border-b border-border flex flex-row items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-foreground" />
                <CardTitle className="text-sm font-semibold">3. Company Team & Role Provisioning</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Creates authenticated user logins with role-based access for this company.
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
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-1">Phone</Label>
                  <Input
                    placeholder="+251 91..."
                    value={user.phone}
                    onChange={(e) => updateUser(user.key, { phone: e.target.value })}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div>
                  <Label className="text-[10px] text-muted-foreground block mb-1">Assigned Role</Label>
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

                <div className="flex items-end gap-1.5">
                  <div className="flex-1">
                    <Label className="text-[10px] text-muted-foreground block mb-1">Password</Label>
                    <Input
                      placeholder="Auto generated"
                      value={user.password}
                      onChange={(e) => updateUser(user.key, { password: e.target.value })}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </div>
                  {users.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUsers((prev) => prev.filter((row) => row.key !== user.key))}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <p className="text-[11px] text-muted-foreground mt-2">
              Leave the password field blank to automatically generate a secure password. You will receive a downloadable CSV upon completion.
            </p>
          </CardContent>

          <CardFooter className="p-5 border-t border-border flex items-center justify-between">
            <Link href="/admin">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                Cancel
              </Button>
            </Link>

            <Button type="submit" disabled={loading} size="sm" className="h-8 text-xs font-medium shadow-xs">
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Provisioning Enterprise...
                </>
              ) : (
                "Provision Company & Generate Logins"
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
