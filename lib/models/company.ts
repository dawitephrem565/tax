import mongoose from "mongoose"

const companySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    companyAddress: { type: String, required: true },
    tinNumber: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    files: {
      license: { type: String, default: "" },
      licenseRegistration: { type: String, default: "" },
      vatCertificate: { type: String, default: "" },
      tinCertificate: { type: String, default: "" },
    },
  },
  { timestamps: true }
)

export const Company =
  mongoose.models.Company || mongoose.model("Company", companySchema)
