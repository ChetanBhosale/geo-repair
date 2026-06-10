/** Format integer cents into a currency string, e.g. (14900, "USD") -> "$149.00". */
export function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100)
  } catch {
    // Unknown currency code — fall back to a plain amount + code.
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}
