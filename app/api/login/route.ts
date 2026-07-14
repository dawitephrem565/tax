import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { connectDB } from "@/lib/db"
import { Company } from "@/lib/models/company"

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    await connectDB()

    const company = await Company.findOne({ email })
    if (!company) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    if (company.status !== "approved") {
      return NextResponse.json(
        { error: "Your account is pending approval" },
        { status: 403 }
      )
    }

    const isPasswordValid = await bcrypt.compare(password, company.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const token = jwt.sign(
      { id: company._id, email: company.email, type: "company" },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    )

    return NextResponse.json({
      token,
      company: {
        id: company._id,
        fullName: company.fullName,
        email: company.email,
        companyAddress: company.companyAddress,
        tinNumber: company.tinNumber,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
