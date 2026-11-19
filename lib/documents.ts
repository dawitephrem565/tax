export const DOCUMENT_LABELS: Record<string, string> = {
  license: "Business License",
  license_registration: "License Registration",
  vat_certificate: "VAT Certificate",
  tin_certificate: "TIN Certificate",
  trade_license_1: "Trade Licence 1",
  trade_license_2: "Trade Licence 2",
  vat_certificate_1: "VAT Certificate 1",
  vat_certificate_2: "VAT Certificate 2",
  neged_mezgeba: "Neged Mezgeba (Company Registration File)",
  neged_seyame: "Neged Seyame (Brand Name Authorization)",
  home_rent_wel: "Home Rent Wel (Lease File)",
  manager_national_id: "National ID of General Manager",
  metedadriya_denb: "Metedadriya Denb (Location Authorization)",
  other: "Other Document",
}

/** Keys used by the original tax app's `files` object. */
export const LEGACY_DOCUMENT_KEYS: Record<string, string> = {
  license: "license",
  license_registration: "licenseRegistration",
  vat_certificate: "vatCertificate",
  tin_certificate: "tinCertificate",
}

export const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function fileUrl(storagePath: string) {
  return `/api/files?path=${encodeURIComponent(storagePath)}`
}

/**
 * Accepts a raw storage path or a URL previously returned by /api/upload
 * (or a legacy signed URL) and returns the object path.
 */
export function extractStoragePath(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("/api/files?path=")) {
    return decodeURIComponent(trimmed.slice("/api/files?path=".length))
  }

  const signed = /\/storage\/v1\/object\/sign\/documents\/([^?]+)/.exec(trimmed)
  if (signed) return decodeURIComponent(signed[1])

  const publicUrl = /\/storage\/v1\/object\/public\/documents\/([^?]+)/.exec(trimmed)
  if (publicUrl) return decodeURIComponent(publicUrl[1])

  if (/^[a-z]+:\/\//i.test(trimmed)) return null
  if (trimmed.startsWith("/")) return null
  return trimmed
}
