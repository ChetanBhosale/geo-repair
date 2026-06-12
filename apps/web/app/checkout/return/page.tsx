import { buildMetadata } from "@/lib/seo"
import { PageHeader } from "@/components/layout/page-header"
import { CheckoutReturnClient } from "./checkout-return-client"

export const metadata = buildMetadata({
  title: "Checkout Return · GEO Repair",
  description:
    "Confirm payment and return to your GEO Repair dashboard.",
  path: "/checkout/return",
  noIndex: true,
})

type PageProps = {
  searchParams:
    | Promise<{ order_id?: string; payment_id?: string; status?: string }>
    | { order_id?: string; payment_id?: string; status?: string }
}

export default async function CheckoutReturnPage({ searchParams }: PageProps) {
  const params = await searchParams
  const orderId = params.order_id

  return (
    <>
      <PageHeader
        eyebrow="Checkout"
        title="Returning to dashboard"
        description="Payment is confirmed here, then you continue in the dashboard."
      />

      <main className="border-t border-border py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          {orderId ? (
            <CheckoutReturnClient
              orderId={orderId}
              paymentId={params.payment_id}
              returnStatus={params.status}
            />
          ) : (
            <div className="border border-border bg-card p-8 text-center">
              <p className="font-heading text-xl font-medium text-foreground">
                Missing order
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                The checkout return URL did not include an order id.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
