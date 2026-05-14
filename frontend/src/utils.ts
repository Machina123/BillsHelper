/** IBAN mod-97 checksum validation. PL + 26-digit NRB = valid Polish IBAN. */
export function validateNrb(digits: string): boolean {
  if (!/^\d{26}$/.test(digits)) return false;
  const iban = "PL" + digits;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged
    .split("")
    .map((c) => (/[A-Z]/i.test(c) ? (c.toUpperCase().charCodeAt(0) - 65 + 10).toString() : c))
    .join("");
  return BigInt(numeric) % 97n === 1n;
}

export function formatNrb(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.replace(
    /(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/,
    "$1 $2 $3 $4 $5 $6 $7"
  );
}
