"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Alert, AlertDescription,
} from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft, CheckCircle2, Plus, Shield,
  Users, AlertCircle, Copy, Eye, EyeOff,
} from "lucide-react"
import { toast } from "sonner"

type Role = "company_admin" | "accountant" | "payroll_officer" | "payroll_manager" | "ceo"

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "company_admin",   label: "Company Admin",    desc: "Full company access" },
  { value: "accountant",      label: "Accountant",       desc: "Receipts & file boxes" },
  { value: "payroll_officer", label: "Payroll Officer",  desc: "Run payroll" },
  { value: "payroll_manager", label: "Payroll Manager",  desc: "Approve payroll" },
  { value: "ceo",             label: "CEO / Executive",  desc: "Executive approvals" },
]

type CompanyUser = {
  userId: string
  fullName: string
  email: string
  phone: string
  role: string
  createdAt: string
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="secondary" className="text-[10px] gap-1 font-normal capitalize">
      <Shield className="w-2.5 h-2.5" />
      {role.replace(/_/g, " ")}
    </Badge>
  )
}

export default function CompanyUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [currentRole, setCurrentRole] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "",
    role: "accountant" as Role, password: "",
  })
  const [saving, setSaving] = useState(false)
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const getHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("token")
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" }
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/company/users", { headers: getHeaders(), credentials: "include" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not load users")
      setUsers(data.users ?? [])
      setCurrentRole(data.currentRole ?? "")
    } catch (err: any) {
      setError(err.message || "Could not load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/"); return }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(""); setIssued(null)
    if (!form.fullName || !form.email) { setError("Full name and email are required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/company/users", {
        method: "POST",
        headers: getHeaders(),
        credentials: "include",
        body: JSON.stringify({
          fullName: form.fullName, email: form.email,
          phone: form.phone, role: form.role,
          password: form.password || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not add the user")
      setIssued(data.credentials)
      setForm({ fullName: "", email: "", phone: "", role: "accountant", password: "" })
      toast.success("Team member added successfully")
      await load()
    } catch (err: any) {
      setError(err.message || "Could not add the user")
    } finally {
      setSaving(false)
    }
  }

  const isAdmin = currentRole === "company_admin" || currentRole === ""

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight">Team Management</span>
              <span className="hidden sm:inline text-xs text-muted-foreground ml-2">Role-based access control</span>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error / Success Alerts */}
        {error && (
          <Alert variant="destructive" className="text-xs">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {issued && (
          <Alert className="border-primary/30 bg-primary/5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <AlertDescription className="space-y-2">
              <p className="font-semibold">User created — share these credentials once</p>
              <div className="flex items-center gap-2 font-mono bg-background border border-border rounded-md px-3 py-2">
                <span>{issued.email}</span>
                <Separator orientation="vertical" className="h-4" />
                <span>{issued.password}</span>
                <Button
                  variant="ghost" size="sm"
                  className="ml-auto h-6 w-6 p-0"
                  onClick={() => { navigator.clipboard.writeText(`${issued.email} / ${issued.password}`); toast.success("Copied!") }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!isAdmin && currentRole && (
          <Alert className="text-xs border-amber-500/30 bg-amber-500/10">
            <Shield className="w-4 h-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              You are signed in as <strong>{currentRole.replace(/_/g, " ")}</strong>. Only a Company Admin can add users.
            </AlertDescription>
          </Alert>
        )}

        {/* Team Members Table */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Team Members</CardTitle>
              <CardDescription className="text-xs">{users.length} member{users.length !== 1 ? "s" : ""} with role-based access</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">{users.length} / ∞</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground">
                      Loading team members...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground">
                      No team members yet. Add your first user below.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.userId} className="text-xs hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 rounded-md">
                            <AvatarFallback className="bg-muted text-foreground text-[10px] font-medium">
                              {(u.fullName || u.email).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{u.fullName || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell><RoleBadge role={u.role} /></TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add User Form */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Team Member
            </CardTitle>
            <CardDescription className="text-xs">
              Invite a new user and assign their RBAC role within your company workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-medium">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="fullName"
                  placeholder="Abebe Kebede"
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email Address <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="abebe@company.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+251 91 123 4567"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">RBAC Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((p) => ({ ...p, role: v as Role }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-xs">
                        <div>
                          <p className="font-medium">{r.label}</p>
                          <p className="text-muted-foreground text-[10px]">{r.desc}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="password" className="text-xs font-medium">
                  Password <span className="text-muted-foreground font-normal">(leave blank to auto-generate)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Leave blank to auto-generate a secure password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    className="h-9 text-xs pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving || !isAdmin}
                className="md:col-span-2 h-9 text-xs font-medium gap-1.5"
              >
                {saving ? "Creating user..." : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Create Team Member
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* RBAC Reference */}
        <Card className="border-border shadow-xs">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-sm font-semibold">RBAC Role Reference</CardTitle>
            <CardDescription className="text-xs">Permissions matrix ported from Odoo Groups</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Role</TableHead>
                  <TableHead>Receipts</TableHead>
                  <TableHead>Payroll</TableHead>
                  <TableHead>Approvals</TableHead>
                  <TableHead>Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { role: "company_admin",   r: "✓", p: "✓", a: "✓", u: "✓" },
                  { role: "accountant",      r: "✓", p: "—", a: "—", u: "—" },
                  { role: "payroll_officer", r: "—", p: "✓", a: "—", u: "—" },
                  { role: "payroll_manager", r: "—", p: "✓", a: "✓", u: "—" },
                  { role: "ceo",             r: "✓", p: "✓", a: "✓", u: "—" },
                ].map((row) => (
                  <TableRow key={row.role} className="text-xs hover:bg-muted/20">
                    <TableCell><RoleBadge role={row.role} /></TableCell>
                    <TableCell className={row.r === "✓" ? "text-primary font-semibold" : "text-muted-foreground"}>{row.r}</TableCell>
                    <TableCell className={row.p === "✓" ? "text-primary font-semibold" : "text-muted-foreground"}>{row.p}</TableCell>
                    <TableCell className={row.a === "✓" ? "text-primary font-semibold" : "text-muted-foreground"}>{row.a}</TableCell>
                    <TableCell className={row.u === "✓" ? "text-primary font-semibold" : "text-muted-foreground"}>{row.u}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
