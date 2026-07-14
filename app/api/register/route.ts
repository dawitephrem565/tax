import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { connectDB } from "@/lib/db"
import { Company } from "@/lib/models/company"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { fullName, companyAddress, tinNumber, phone, email, password, files } = body

    if (!fullName || !companyAddress || !tinNumber || !phone || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    if (!files?.license || !files?.licenseRegistration || !files?.vatCertificate || !files?.tinCertificate) {
      return NextResponse.json(
        { error: "All documents must be uploaded" },
        { status: 400 }
      )
    }

    await connectDB()

    const existingCompany = await Company.findOne({
      $or: [{ email }, { tinNumber }],
    })
    if (existingCompany) {
      return NextResponse.json(
        { error: "Company with this email or TIN already exists" },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const company = await Company.create({
      fullName,
      companyAddress,
      tinNumber,
      phone,
      email,
      password: hashedPassword,
      files,
      status: "pending",
    })

    return NextResponse.json(
      {
        message: "Registration submitted successfully",
        companyId: company._id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
