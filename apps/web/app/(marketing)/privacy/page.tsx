import Link from "next/link"

import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHeader } from "@/components/layout/page-header"
import { Prose } from "@/components/layout/prose"

export const metadata = buildMetadata({
  title: "Privacy Policy · Zero Retention, No Model Training · GEO Repair",
  description:
    "How GEO Repair handles your data: your code lives only in an ephemeral sandbox, is never retained after a run, and is never used to train models.",
  path: "/privacy",
})

const LAST_UPDATED = "June 2, 2026"

export default function PrivacyPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Privacy Policy", path: "/privacy" },
        ])}
      />

      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description={`Last updated ${LAST_UPDATED}`}
      />

      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Prose>
            <p>
              This Privacy Policy explains what GEO Repair collects, how we use
              it, and, just as importantly, what we never do with it. The
              short version: your code lives only inside an ephemeral sandbox
              for a single run, is never retained afterward, and is never used
              to train models.
            </p>

            <h2>Our core commitments</h2>
            <ul>
              <li>
                <strong>Zero data retention.</strong> We clone the one
                repository you pick into an ephemeral sandbox, make the fixes,
                open the pull request, and destroy the sandbox and the clone.
                Nothing about your code persists on our side.
              </li>
              <li>
                <strong>No model training.</strong> Your code is never used to
                train, fine-tune, or evaluate models. It is read only to make
                the specific fixes you approved.
              </li>
              <li>
                <strong>Least privilege.</strong> We request access to the
                single repository you select, never your other repositories,
                organization, or account-wide permissions.
              </li>
              <li>
                <strong>No third-party sharing.</strong> We don&rsquo;t sell or
                share your source code, and we don&rsquo;t pass it to
                third-party services beyond what&rsquo;s strictly needed to open
                your pull request.
              </li>
            </ul>

            <h2>What we collect</h2>
            <h3>The free checkup</h3>
            <p>
              The checkup fetches your public pages, the same way an AI crawler
              would, and respects your robots.txt. It never touches your
              repository. We store the URL you scanned and the resulting
              readiness score so you can revisit your report.
            </p>
            <h3>Account information</h3>
            <p>
              If you create an account, we collect your email address and
              authentication details from your identity provider. If you
              subscribe, our payment processor handles your card details, and we
              never see or store full card numbers.
            </p>
            <h3>Repository data during a fix run</h3>
            <p>
              When you approve a fix, your repository is cloned into an
              ephemeral sandbox solely for that run. The agent reads only what
              it needs to edit the flagged checks. When the run ends, the
              sandbox and clone are destroyed.
            </p>
            <h3>Usage analytics</h3>
            <p>
              We use privacy-respecting product analytics to understand how the
              Service is used in aggregate. This does not include your source
              code.
            </p>

            <h2>How we use information</h2>
            <ul>
              <li>To run the checkup and return your readiness report.</li>
              <li>
                To open the pull requests you approve and re-check readiness
                afterward.
              </li>
              <li>To operate, secure, and improve the Service.</li>
              <li>
                To communicate with you about your account, support requests,
                and service changes.
              </li>
            </ul>

            <h2>Data retention</h2>
            <p>
              Source code is never retained beyond the lifetime of a single
              sandboxed run. Account information is kept while your account is
              active and deleted on request. Checkup results and aggregate
              analytics are kept to provide the Service and may be retained in
              de-identified form.
            </p>

            <h2>Your rights</h2>
            <p>
              You can request access to, correction of, or deletion of your
              account information at any time by emailing{" "}
              <a href="mailto:privacy@geo.repair">privacy@geo.repair</a>.
              Disconnecting a repository immediately revokes our access to it.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will
              be reflected by the &ldquo;last updated&rdquo; date above.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about your privacy? Email{" "}
              <a href="mailto:privacy@geo.repair">privacy@geo.repair</a>, or read
              more on our <Link href="/security">Security</Link> page.
            </p>
          </Prose>
        </div>
      </section>
    </>
  )
}
