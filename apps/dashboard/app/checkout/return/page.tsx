import { redirect } from "next/navigation"

const WEB_URL = (
  process.env.NEXT_PUBLIC_WEB_URL ??
  process.env.WEB_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://geo.repair"
    : "http://localhost:3001")
).replace(/\/+$/, "")

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams: Promise<SearchParams> | SearchParams
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function CheckoutReturnRedirect({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const target = new URL("/checkout/return", WEB_URL)

  for (const [key, value] of Object.entries(params)) {
    const firstValue = firstParam(value)
    if (firstValue) {
      target.searchParams.set(key, firstValue)
    }
  }

  redirect(target.toString())
}
