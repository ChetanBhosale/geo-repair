import type { Metadata } from "next"
import { Geist, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/query-provider"
import { cn } from "@/lib/utils";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

const DESCRIPTION =
  "Manage your AI search audits and fixes — the GEO Repair dashboard for ChatGPT, Perplexity, and Google AI Overviews."

export const metadata: Metadata = {
  metadataBase: new URL("https://app.geo.repair"),
  title: {
    default: "GEO Repair · Dashboard",
    template: "%s · GEO Repair",
  },
  description: DESCRIPTION,
  applicationName: "GEO Repair",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "GEO Repair",
    url: "https://app.geo.repair",
    title: "GEO Repair · Dashboard",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    site: "@GeoRepair",
    creator: "@GeoRepair",
    title: "GEO Repair · Dashboard",
    description: DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, jetbrainsMono.variable)}
    >
      <body className="font-sans">
        <ThemeProvider defaultTheme="light">
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
