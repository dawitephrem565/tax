import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { connectDB } from "@/lib/db"
import { Report } from "@/lib/models/report"

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string
      type: string
    }
    if (decoded.type !== "company") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { reportType, files } = await req.json()

    if (!reportType || !files?.length) {
      return NextResponse.json(
        { error: "Report type and at least one file are required" },
        { status: 400 }
      )
    }

    await connectDB()

    const report = await Report.create({
      companyId: decoded.id,
      reportType,
      files,
      status: "Pending",
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error("Create report error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.split(" ")[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string
      type: string
    }

    await connectDB()

    let reports
    if (decoded.type === "admin") {
      reports = await Report.find()
        .populate("companyId", "fullName tinNumber email")
        .sort({ createdAt: -1 })
    } else {
      reports = await Report.find({ companyId: decoded.id }).sort({
        createdAt: -1,
      })
    }

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("Get reports error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
