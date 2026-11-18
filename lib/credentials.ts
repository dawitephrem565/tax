const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const SYMBOLS = "!@#$%&*"

/** Readable temporary password, like the Odoo portal's generated credentials. */
export function generatePassword(length = 10) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let value = ""
  for (let i = 0; i < length; i++) {
    value += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `${value}${SYMBOLS[bytes[0] % SYMBOLS.length]}${bytes[1] % 10}`
}
