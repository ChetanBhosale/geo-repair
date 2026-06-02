export type TrustPromise = {
  title: string
  body: string
}

// The verbatim trust commitments. Single source for the homepage trust section
// and the /security page; keep wording consistent across both.
export const TRUST_PROMISES: TrustPromise[] = [
  {
    title: "Your code is never kept",
    body: "We clone your repository into an ephemeral sandbox, make the fixes, open the pull request, and destroy the sandbox. Nothing persists after the run.",
  },
  {
    title: "Only the one repo you pick is touched",
    body: "Least-privilege by design. We request access to a single repository, the one you choose, and never the rest of your account or organization.",
  },
  {
    title: "No confidential data leaves to third parties",
    body: "Your source stays inside the run. We don't sell it, share it, or pass it to third-party services beyond what's needed to open your pull request.",
  },
  {
    title: "Zero data retention, no model training",
    body: "Your code is never used to train models and is not retained after the sandbox is destroyed. Readiness is measured, the fix is shipped, and nothing is stored.",
  },
]

export const TRUST_TAGLINE =
  "The free checkup runs on your public pages. The fix agent runs on one repo, in a sandbox, then disappears."
