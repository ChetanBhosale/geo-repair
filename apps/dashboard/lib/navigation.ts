export const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/website-scan", label: "Website Scan" },
  { href: "/fix-agent", label: "Fix Agent" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const

export const sidebarUtilityItems = [
  { href: "mailto:support@geo.repair", label: "Contact support" },
  {
    href: "mailto:feedback@geo.repair?subject=Dashboard%20feedback",
    label: "Submit feedback",
  },
] as const
