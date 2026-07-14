import mongoose from "mongoose"

const reportSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    reportType: {
      type: String,
      enum: [
        "VAT",
        "Withholding Tax",
        "Pension",
        "Income Tax",
        "Sold Receipt",
        "Withhold Receipt",
      ],
      required: true,
    },
    files: [String],
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { timestamps: true }
)

export const Report =
  mongoose.models.Report || mongoose.model("Report", reportSchema)
