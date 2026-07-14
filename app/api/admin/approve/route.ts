import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { connectDB } from "@/lib/db"
import { Company } from "@/lib/models/company"

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { type: string }
    if (decoded.type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { companyId, action } = await req.json()

    if (!companyId || !["approved", "rejected"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid request. Provide companyId and action (approved/rejected)" },
        { status: 400 }
      )
    }

    await connectDB()

    const company = await Company.findByIdAndUpdate(
      companyId,
      { status: action },
      { new: true }
    ).select("-password")

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    return NextResponse.json({
      message: `Company ${action} successfully`,
      company,
    })
  } catch (error) {
    console.error("Approve error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
