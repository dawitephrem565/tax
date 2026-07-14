import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { connectDB } from "@/lib/db"
import { Company } from "@/lib/models/company"

export async function GET(req: Request) {
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

    await connectDB()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")

    const filter = status ? { status } : {}
    const companies = await Company.find(filter).select("-password").sort({ createdAt: -1 })

    return NextResponse.json({ companies })
  } catch (error) {
    console.error("Get companies error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
