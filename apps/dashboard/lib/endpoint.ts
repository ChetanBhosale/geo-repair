import FrontendSecrets from "@repo/secrets/frontend"

// Backend base URL from secrets (NEXT_PUBLIC_BACKEND_URL), trailing slash stripped.
export const BACKEND_URL = (
  FrontendSecrets.PUBLIC_BACKEND ?? "http://localhost:4000"
).replace(/\/+$/, "")

// Full backend endpoints. Add new paths here so URLs live in one place.
export const ENDPOINTS = {
  audit: `${BACKEND_URL}/api/checkups`,
  temporalStatus: (temporalId: string) =>
    `${BACKEND_URL}/api/checkups/${encodeURIComponent(temporalId)}/status`,
  auditResult: (key: string) =>
    `${BACKEND_URL}/api/checkup-reports/${encodeURIComponent(key)}`,

  // Auth (cookie session). Hitting githubLogin in the browser starts the OAuth flow.
  githubLogin: `${BACKEND_URL}/api/auth/github`,
  me: `${BACKEND_URL}/api/auth/me`,
  logout: `${BACKEND_URL}/api/auth/logout`,

  // GitHub
  repos: `${BACKEND_URL}/api/github/repos`,
  savedRepos: `${BACKEND_URL}/api/github/repos/saved`,
  selectRepo: `${BACKEND_URL}/api/github/repos/select`,
  repoWebsite: (id: string) =>
    `${BACKEND_URL}/api/github/repos/${encodeURIComponent(id)}/website`,

  // Fix runs (premium)
  fix: `${BACKEND_URL}/api/fix`,
  fixRuns: `${BACKEND_URL}/api/fix-runs`,
  fixRun: (id: string) => `${BACKEND_URL}/api/fix/${encodeURIComponent(id)}`,
  fixIntake: (id: string) =>
    `${BACKEND_URL}/api/fix/${encodeURIComponent(id)}/intake`,

  // Reports
  reports: `${BACKEND_URL}/api/reports`,
  generateReports: `${BACKEND_URL}/api/reports/generate`,
  report: (id: string) =>
    `${BACKEND_URL}/api/reports/${encodeURIComponent(id)}`,
  reportDownload: (id: string) =>
    `${BACKEND_URL}/api/reports/${encodeURIComponent(id)}/download`,
  reportShare: (id: string) =>
    `${BACKEND_URL}/api/reports/${encodeURIComponent(id)}/share-link`,
  sharedReport: (token: string) =>
    `${BACKEND_URL}/api/reports/share/${encodeURIComponent(token)}`,
  sharedReportDownload: (token: string) =>
    `${BACKEND_URL}/api/reports/share/${encodeURIComponent(token)}/download`,

  // Billing
  fixCheckout: `${BACKEND_URL}/api/billing/fix-checkout`,
  billingHistory: `${BACKEND_URL}/api/billing/history`,
  billingInvoice: (orderId: string) =>
    `${BACKEND_URL}/api/billing/invoices/${encodeURIComponent(orderId)}`,
  billingInvoiceDownload: (orderId: string) =>
    `${BACKEND_URL}/api/billing/invoices/${encodeURIComponent(orderId)}/download`,
} as const
