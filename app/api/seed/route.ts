import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { Admin } from "@/lib/models/admin"
import { Company } from "@/lib/models/company"

const DEFAULT_COMPANIES = [
  {
    fullName: "ABC Trading PLC",
    companyAddress: "Bole Subcity, Addis Ababa",
    tinNumber: "TIN-001-2024",
    phone: "+251911123456",
    email: "abc@example.com",
    status: "approved",
  },
  {
    fullName: "XYZ Construction PLC",
    companyAddress: "Kirkos Subcity, Addis Ababa",
    tinNumber: "TIN-002-2024",
    phone: "+251922234567",
    email: "xyz@example.com",
    status: "pending",
  },
  {
    fullName: "Global Imports PLC",
    companyAddress: "Mexico Square, Addis Ababa",
    tinNumber: "TIN-003-2024",
    phone: "+251933345678",
    email: "global@example.com",
    status: "pending",
  },
]

export async function GET() {
  try {
    await connectDB()

    const existingAdmin = await Admin.findOne({ username: "admin" })
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 12)
      await Admin.create({ username: "admin", password: hashedPassword })
    }

    let companiesCreated = 0
    for (const c of DEFAULT_COMPANIES) {
      const existing = await Company.findOne({ email: c.email })
      if (!existing) {
        const hashedPassword = await bcrypt.hash("password123", 12)
        await Company.create({
          ...c,
          password: hashedPassword,
          files: {
            license: "/uploads/demo-license.pdf",
            licenseRegistration: "/uploads/demo-reg.pdf",
            vatCertificate: "/uploads/demo-vat.pdf",
            tinCertificate: "/uploads/demo-tin.pdf",
          },
        })
        companiesCreated++
      }
    }

    return NextResponse.json({
      message: "Seed completed",
      admin: { username: "admin", password: "admin123" },
      companiesSeeded: companiesCreated,
    })
  } catch (error) {
    console.error("Seed error:", error)
    return NextResponse.json({ error: "Seed failed" }, { status: 500 })
  }
}
