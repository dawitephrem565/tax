import mongoose from "mongoose"
import bcrypt from "bcryptjs"

const MONGODB_URI = "mongodb://react_demo:mW64xTLJEeMGcDux@ac-yb5r5xu-shard-00-00.lzo6ofl.mongodb.net:27017,ac-yb5r5xu-shard-00-01.lzo6ofl.mongodb.net:27017,ac-yb5r5xu-shard-00-02.lzo6ofl.mongodb.net:27017/tax?replicaSet=atlas-12brts-shard-0&ssl=true&authSource=admin"

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log("Connected to MongoDB")

  const Admin = mongoose.models.Admin || mongoose.model("Admin", new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  }, { timestamps: true }))

  const existingAdmin = await Admin.findOne({ username: "admin" })
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin123", 12)
    await Admin.create({ username: "admin", password: hashedPassword })
    console.log("Admin user created: admin / admin123")
  } else {
    console.log("Admin user already exists")
  }

  const Company = mongoose.models.Company || mongoose.model("Company", new mongoose.Schema({
    fullName: String,
    companyAddress: String,
    tinNumber: { type: String, unique: true },
    phone: String,
    email: { type: String, unique: true },
    password: String,
    status: { type: String, default: "pending" },
    files: {
      license: String,
      licenseRegistration: String,
      vatCertificate: String,
      tinCertificate: String,
    },
  }, { timestamps: true }))

  const mockCompanies = [
    {
      fullName: "ABC Trading PLC",
      companyAddress: "Bole Subcity, Addis Ababa",
      tinNumber: "TIN-001-2024",
      phone: "+251911123456",
      email: "abc@example.com",
      password: await bcrypt.hash("password123", 12),
      status: "approved",
      files: {
        license: "/uploads/demo-license.pdf",
        licenseRegistration: "/uploads/demo-reg.pdf",
        vatCertificate: "/uploads/demo-vat.pdf",
        tinCertificate: "/uploads/demo-tin.pdf",
      },
    },
    {
      fullName: "XYZ Construction PLC",
      companyAddress: "Kirkos Subcity, Addis Ababa",
      tinNumber: "TIN-002-2024",
      phone: "+251922234567",
      email: "xyz@example.com",
      password: await bcrypt.hash("password123", 12),
      status: "pending",
      files: {
        license: "/uploads/demo-license.pdf",
        licenseRegistration: "/uploads/demo-reg.pdf",
        vatCertificate: "/uploads/demo-vat.pdf",
        tinCertificate: "/uploads/demo-tin.pdf",
      },
    },
    {
      fullName: "Global Imports PLC",
      companyAddress: "Mexico Square, Addis Ababa",
      tinNumber: "TIN-003-2024",
      phone: "+251933345678",
      email: "global@example.com",
      password: await bcrypt.hash("password123", 12),
      status: "pending",
      files: {
        license: "/uploads/demo-license.pdf",
        licenseRegistration: "/uploads/demo-reg.pdf",
        vatCertificate: "/uploads/demo-vat.pdf",
        tinCertificate: "/uploads/demo-tin.pdf",
      },
    },
  ]

  for (const company of mockCompanies) {
    const existing = await Company.findOne({ email: company.email })
    if (!existing) {
      await Company.create(company)
      console.log(`Seeded company: ${company.fullName}`)
    } else {
      console.log(`Company already exists: ${company.fullName}`)
    }
  }

  await mongoose.disconnect()
  console.log("Done!")
}

seed().catch(console.error)
