import Link from "next/link"

import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHeader } from "@/components/layout/page-header"
import { Prose } from "@/components/layout/prose"

export const metadata = buildMetadata({
  title: "Terms of Service · GEO Repair",
  description:
    "The terms that govern your use of GEO Repair: the free readiness checkup, the AI fix agent, repository access, and your responsibilities as a user.",
  path: "/terms",
})

const LAST_UPDATED = "June 2, 2026"

export default function TermsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Terms of Service", path: "/terms" },
        ])}
      />

      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description={`Last updated ${LAST_UPDATED}`}
      />

      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <Prose>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
              and use of GEO Repair (the &ldquo;Service&rdquo;), including the
              free readiness checkup and the AI fix agent. By using the Service
              you agree to these Terms. If you do not agree, do not use the
              Service.
            </p>

            <h2>The Service</h2>
            <p>
              GEO Repair runs a readiness checkup that fetches your public web
              pages (the same way an AI crawler would) and scores how ready
              they are for AI search engines to read and cite. If you connect a
              repository, the AI fix agent edits the checks it flagged in an
              ephemeral sandbox and opens a pull request for your review.
            </p>

            <h2>What we do not promise</h2>
            <p>
              The Service measures and improves technical readiness. We do{" "}
              <strong>not</strong> promise increased traffic, higher rankings,
              or that any AI system will cite your site. Those outcomes depend
              on factors outside our control. Any score, estimate, or
              recommendation is provided for guidance and is not a guarantee of
              any result.
            </p>

            <h2>Your account and repository access</h2>
            <ul>
              <li>
                You must provide accurate information and are responsible for
                activity under your account.
              </li>
              <li>
                When you connect a repository, you grant us least-privilege
                access to the single repository you select, never your other
                repositories, organization, or account-wide permissions.
              </li>
              <li>
                You are responsible for reviewing every pull request the agent
                opens before you merge it. Nothing ships to your default branch
                without your action.
              </li>
            </ul>

            <h2>Acceptable use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>
                Scan or modify property you do not own or have permission to
                act on.
              </li>
              <li>
                Circumvent access controls, rate limits, or the robots.txt of
                sites you do not control.
              </li>
              <li>
                Reverse-engineer, resell, or overload the Service, or use it to
                build a competing product.
              </li>
            </ul>

            <h2>Plans and billing</h2>
            <p>
              The checkup is free. Paid plans, such as AI Search Autopilot, are
              billed in advance on a recurring basis and are month-to-month
              unless stated otherwise. You can cancel at any time; cancellation
              takes effect at the end of the current billing period.
            </p>

            <h2>Intellectual property</h2>
            <p>
              You retain all rights to your code and content. The pull requests
              the agent opens are your work product to accept, modify, or
              reject. We retain rights to the Service itself, including its
              software, rubric, and brand.
            </p>

            <h2>Disclaimers and liability</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of
              any kind. To the maximum extent permitted by law, GEO Repair is
              not liable for indirect, incidental, or consequential damages, or
              for any loss arising from changes you choose to merge.
            </p>

            <h2>Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will
              be reflected by the &ldquo;last updated&rdquo; date above.
              Continued use after a change means you accept the revised Terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a href="mailto:hello@geo.repair">hello@geo.repair</a> or see our{" "}
              <Link href="/privacy">Privacy Policy</Link> and{" "}
              <Link href="/security">Security</Link> pages.
            </p>
          </Prose>
        </div>
      </section>
    </>
  )
}
