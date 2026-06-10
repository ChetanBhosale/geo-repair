import { check_intent } from "./check-intent";
import type { DomainFiles, TwinProbe } from "./fetcher";
import { AI_CRAWLERS } from "./fetcher";
import type { PageModel } from "./parser";
import type { PageType } from "./pagetype";
import type {
  CheckResultOut,
  RepoInput,
  RepoMatchOut,
  Verdict,
} from "./types";

export interface CheckContext {
  url: URL;
  page: PageModel;
  domain: DomainFiles;
  pageType: PageType;
  // Markdown-twin / content-negotiation probe (AEO delivery). Optional so unit
  // callers that don't probe still type-check; absent => delivery checks FAIL.
  twin?: TwinProbe;
}

// Content-judgment checks only apply to real content pages. On landing/utility/
// legal/product pages they are NOT_APPLICABLE (so a clean marketing homepage is
// never failed for "no FAQ"). The site-level rollup recommends adding content
// only when the whole site has no content pages.
// Content-judgment checks only apply to real content pages, matching the old
// backend's ANSWER_CONTENT_TYPES. freshness-eeat applies to every page type
// (it is intentionally NOT gated here).
const CONTENT_CHECK_PAGETYPES: Record<string, PageType[]> = {
  answerability: ["article", "listing", "documentation", "generic"],
  definitions: ["article", "listing", "documentation", "generic"],
  "citation-quality": ["article", "listing", "documentation", "generic"],
};

type Evaluator = (ctx: CheckContext) => Verdict;

const PASS = (summary: string, extra: Partial<Verdict> = {}): Verdict => ({
  status: "SUCCESS",
  summary,
  method: "deterministic",
  ...extra,
});
const MID = (summary: string, extra: Partial<Verdict> = {}): Verdict => ({
  status: "MID",
  summary,
  method: "deterministic",
  recommendedAction: "mark_up_existing",
  ...extra,
});
const FAIL = (summary: string, extra: Partial<Verdict> = {}): Verdict => ({
  status: "FAILED",
  summary,
  method: "deterministic",
  ...extra,
});
const NA = (summary: string): Verdict => ({
  status: "NOT_APPLICABLE",
  summary,
  method: "deterministic",
  recommendedAction: "none",
});

const TRUSTED_CITE = /(\.gov|\.edu|wikipedia\.org|doi\.org|arxiv\.org|w3\.org|developer\.mozilla\.org|pewresearch\.org|nature\.com|who\.int)([/:?#]|$)/i;
const SOCIAL_HOST = /(twitter\.com|\/\/x\.com|\.x\.com|facebook\.com|fb\.com|linkedin\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|pinterest\.com|threads\.net|mastodon|reddit\.com|t\.me|wa\.me|whatsapp\.com)/i;
const QUESTION = /^(how|what|why|when|where|who|which|can|is|are|does|do|should|will)\b/i;
const DATE_HINT = /\b(20\d{2}|19\d{2})\b/;

function looksAbsolute(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

// --- one evaluator per RUBRIC check -----------------------------------------

const EVALUATORS: Record<string, Evaluator> = {
  "ssr-visibility": ({ page }) => {
    if (page.spaRootDetected || page.wordCount < 120) {
      return FAIL(
        "Little or no primary content is in the server HTML; it likely renders client-side, which AI crawlers miss.",
        { evidence: `${page.wordCount} words in no-JS HTML`, recommendedAction: "flag_only" },
      );
    }
    return PASS(`Primary content is in the server HTML (${page.wordCount} words).`);
  },

  "structured-data": ({ page }) => {
    const valid = page.jsonLd.filter((b) => b.valid);
    const invalid = page.jsonLd.filter((b) => !b.valid);
    if (page.jsonLd.length === 0) {
      return FAIL("No JSON-LD structured data found.", {
        recommendedAction: "add_content",
        recommendation: "Add Organization and WebSite JSON-LD site-wide, and Article/Product schema where it applies.",
        fixHint: "Add a <script type=\"application/ld+json\"> block with real data.",
      });
    }
    if (invalid.length) return MID(`${valid.length} valid, ${invalid.length} invalid JSON-LD block(s).`);
    return PASS(`Valid JSON-LD found: ${[...new Set(valid.flatMap((b) => b.types))].join(", ") || "present"}.`);
  },

  "meta-tags": ({ page }) => {
    const desc = page.metaByKey.get("description") ?? "";
    if (!page.title && !desc) return FAIL("Missing both <title> and meta description.", { recommendedAction: "add_content" });
    if (!page.title) return FAIL("Missing <title>.", { recommendedAction: "add_content" });
    if (!desc) return MID("Has <title> but no meta description.", { recommendedAction: "add_content" });
    const titleLen = page.title.length;
    const descLen = desc.length;
    const titleOk = titleLen >= 30 && titleLen <= 65;
    const descOk = descLen >= 110 && descLen <= 170;
    if (titleOk && descOk) return PASS("Title and description present and within length guidance.");
    return MID(`Present but off-length (title ${titleLen} chars, description ${descLen} chars).`, {
      fixHint: "Title ~50-60 chars, description ~120-160 chars.",
    });
  },

  "open-graph": ({ page }) => {
    const need = ["og:title", "og:description", "og:url", "og:type", "og:image"];
    const have = need.filter((k) => page.metaByKey.has(k));
    const twitter = page.metaByKey.has("twitter:card");
    if (have.length === 0) return FAIL("No Open Graph tags found.", { recommendedAction: "add_content", fixHint: "Add og:title/description/url/type/image and a twitter:card." });
    if (have.length < need.length || !twitter) {
      return MID(`Incomplete Open Graph (${have.length}/${need.length} core tags${twitter ? "" : ", no twitter:card"}).`);
    }
    return PASS("Complete Open Graph + Twitter card tags present.");
  },

  "canonical-urls": ({ page, url }) => {
    if (!page.canonical) return FAIL("No canonical URL.", { recommendedAction: "add_content", fixHint: "Add a self-referential absolute <link rel=\"canonical\">." });
    const absolute = /^https?:\/\//i.test(page.canonical);
    if (!absolute) return MID("Canonical is not absolute.", { evidence: page.canonical });
    return PASS("Self-referential absolute canonical present.", { evidence: page.canonical });
  },

  "robots-ai-crawlers": ({ domain }) => {
    if (!domain.robots.fetched) return MID("No robots.txt found; AI crawlers are allowed by default but a robots.txt is recommended.", { recommendedAction: "add_content" });
    const blocked = domain.robots.aiCrawlerRules.filter((r) => r.blocked).map((r) => r.agent);
    if (blocked.length) return FAIL(`robots.txt blocks AI crawlers: ${blocked.join(", ")}.`, { evidence: `${domain.origin}/robots.txt` });
    return PASS("robots.txt allows the major AI crawlers.");
  },

  sitemap: ({ domain }) => {
    if (!domain.sitemap.ok) return FAIL("No valid XML sitemap found.", { recommendedAction: "add_content", fixHint: "Generate sitemap.xml and reference it in robots.txt." });
    if (!domain.sitemap.referencedInRobots) return MID("Sitemap exists but is not referenced in robots.txt.");
    return PASS(`Sitemap present (${domain.sitemap.urlCount} URLs) and referenced in robots.txt.`);
  },

  "llms-txt": ({ domain }) => {
    if (!domain.llmsTxt.ok || !domain.llmsTxt.nonEmpty) {
      return FAIL("No /llms.txt found.", {
        recommendedAction: "add_content",
        recommendation: "Add /llms.txt (Markdown) with the site name, description, and curated key-page links.",
      });
    }
    if (!domain.llmsTxt.hasLinks) return MID("/llms.txt exists but has no curated links.");
    return PASS("/llms.txt present with links.");
  },

  "semantic-html": ({ page }) => {
    const bad: string[] = [];
    if (page.h1Count === 0) bad.push("no <h1>");
    if (page.h1Count > 1) bad.push(`${page.h1Count} <h1> tags`);
    if (!page.landmarks.main) bad.push("no <main>");
    if (bad.length === 0 && page.landmarks.header && page.landmarks.footer) {
      return PASS("One h1, landmarks present, sound structure.");
    }
    if (bad.length) return MID(`Heading/landmark issues: ${bad.join(", ")}.`);
    return MID("Some landmarks missing.");
  },

  "image-alt-text": ({ page }) => {
    if (page.images.length === 0) return NA("No images on the page.");
    const missing = page.images.filter((i) => !i.hasAlt && !i.decorative).length;
    if (missing === 0) return PASS("All meaningful images have alt text.");
    if (missing <= 2) return MID(`${missing} image(s) missing alt text.`);
    return FAIL(`${missing} images missing alt text.`);
  },

  "internal-linking": ({ page, url }) => {
    const internal = page.anchors.filter((a) => {
      try {
        return new URL(a.href, url).origin === url.origin;
      } catch {
        return false;
      }
    });
    if (internal.length === 0) return MID("No internal links found on the page.");
    const generic = internal.filter((a) => /^(click here|read more|here|learn more)$/i.test(a.text.trim()));
    if (generic.length > 2) return MID(`${generic.length} non-descriptive anchor texts (e.g. "click here").`);
    return PASS(`${internal.length} internal links with descriptive anchors.`);
  },

  answerability: ({ page }) => {
    const hasFaqSchema = page.jsonLd.some((b) => b.types.some((t) => /faqpage|qapage/i.test(t)));
    const questionHeads = page.headings.filter(
      (h) => h.text.trim().endsWith("?") || QUESTION.test(h.text.trim()),
    );
    if (hasFaqSchema && questionHeads.length > 0) {
      return { status: "SUCCESS", summary: "Question-shaped headings and FAQ schema make answers easy to extract.", method: "heuristic" };
    }
    if (questionHeads.length >= 2) {
      return {
        status: "MID",
        summary: "Question-shaped headings exist but no FAQPage schema marks them up for answer engines.",
        method: "heuristic",
        recommendedAction: "mark_up_existing",
        fixHint: "Add FAQPage schema where Q&A already renders. Net-new FAQ authoring is gated (Tier C).",
      };
    }
    return {
      status: "FAILED",
      summary: "No question-shaped headings or FAQ structure found, so answer engines have little to quote directly.",
      method: "heuristic",
      recommendedAction: "add_page",
      recommendation: "Surface question-and-answer structure where it fits. Net-new FAQ content is gated (Tier C).",
    };
  },

  "freshness-eeat": ({ page }) => {
    const hasDate =
      DATE_HINT.test(page.visibleText.slice(0, 4000)) ||
      page.metaByKey.has("article:published_time") ||
      page.metaByKey.has("article:modified_time");
    const hasAuthor =
      page.metaByKey.has("author") ||
      page.metaByKey.has("article:author") ||
      page.jsonLd.some((b) => b.types.length > 0 && /author/i.test(JSON.stringify(b.types)));
    const hasAboutContact = page.anchors.some((a) => /\/(about|contact)(\/|$|#)/i.test(a.href));
    const score = [hasDate, hasAuthor, hasAboutContact].filter(Boolean).length;
    if (score >= 2) return { status: "SUCCESS", summary: "Freshness and authorship signals are present.", method: "heuristic" };
    if (score === 1) return { status: "MID", summary: "Some E-E-A-T signals present but key ones are missing.", method: "heuristic", recommendedAction: "add_content", fixHint: "Surface visible dates, author, and about/contact where derivable." };
    return { status: "FAILED", summary: "No date, author, or about/contact signals found, weakening trust signals.", method: "heuristic", recommendedAction: "add_content", recommendation: "Add visible published/updated dates and author/about info." };
  },

  "interactive-labels": ({ page }) => {
    if (page.interactives.length === 0) return NA("No buttons detected on the page.");
    const unnamed = page.interactives.filter((i) => !i.hasName).length;
    if (unnamed === 0) return PASS("All detected interactive controls have accessible names.");
    return MID(`${unnamed} interactive control(s) without an accessible name.`);
  },

  indexability: ({ page, domain }) => {
    const robotsMeta = (page.metaRobots ?? "").toLowerCase();
    const xRobots = (page.xRobotsTag ?? "").toLowerCase();
    if (robotsMeta.includes("noindex") || xRobots.includes("noindex")) {
      return FAIL("Page is noindex (meta robots or X-Robots-Tag).", { evidence: page.metaRobots ?? page.xRobotsTag ?? "", recommendedAction: "flag_only" });
    }
    if (domain.robots.blocksGooglebot) return FAIL("robots.txt blocks Googlebot.", { evidence: `${domain.origin}/robots.txt` });
    if (page.status !== 200) return MID(`Page returned HTTP ${page.status}.`);
    return PASS("Page is eligible for indexing (200, no noindex, not blocked).");
  },

  "citation-quality": ({ page, url }) => {
    const external = page.anchors.filter((a) => {
      try {
        return new URL(a.href, url).origin !== url.origin && looksAbsolute(a.href);
      } catch {
        return false;
      }
    });
    const citations = external.filter((a) => !SOCIAL_HOST.test(a.href));
    const authoritative = citations.filter((a) => TRUSTED_CITE.test(a.href));
    if (citations.length >= 2) {
      return { status: "SUCCESS", summary: `Page backs its claims with ${citations.length} outbound citations${authoritative.length ? ", some to recognised authorities." : "."}`, method: "heuristic" };
    }
    if (citations.length === 1) {
      return { status: "MID", summary: "The page links to a single external source; a couple more references would strengthen citation-readiness.", method: "heuristic", recommendedAction: "add_content", fixHint: "Where the prose names a source or statistic, link out to it." };
    }
    return { status: "FAILED", summary: "The page makes claims without citing any external source (social and share links are not counted).", method: "heuristic", recommendedAction: "add_content", recommendation: "Where the prose names a source or statistic, link out to it. Never invent a source." };
  },

  definitions: ({ page }) => {
    const hasDefinedTerm = page.jsonLd.some((b) => b.types.some((t) => /definedterm/i.test(t)));
    const defHeading = page.headings.some((h) => /^\s*what\s+(is|are|do|does)\b/i.test(h.text.trim()));
    const lead = page.visibleText.slice(0, 600);
    const definitional = /\b[A-Z][\w-]+(?:\s+[\w-]+){0,5}\s+(is|are|refers to|means|stands for)\b/.test(lead);
    if (hasDefinedTerm) {
      return { status: "SUCCESS", summary: "Defined terms are marked up with DefinedTerm schema, so answer engines can extract the definition directly.", method: "heuristic" };
    }
    if (definitional || defHeading) {
      return { status: "MID", summary: "Content is answer-first/definitional but does not mark up defined terms with schema.", method: "heuristic", recommendedAction: "mark_up_existing", evidence: lead.slice(0, 120).trim() || null, fixHint: "Mark up the existing definition with DefinedTerm schema. Net-new definitions are gated (Tier C)." };
    }
    return { status: "FAILED", summary: "Content does not lead with a plain definition or answer, which top studies link to AI quoting.", method: "heuristic", recommendedAction: "add_content", recommendation: "Surface an existing definition to the top of its section. Net-new copy is gated (Tier C)." };
  },

  charset: ({ page }) => {
    if (!page.charsetValue) return FAIL("No <meta charset> declared.", { fixHint: "Add <meta charset=\"utf-8\"> as the first tag in <head>." });
    if (!page.charsetEarly) return MID("Charset declared but not within the first 1024 bytes.");
    return PASS(`Charset "${page.charsetValue}" declared early.`);
  },

  doctype: ({ page }) =>
    page.hasDoctype ? PASS("HTML5 <!DOCTYPE html> present.") : FAIL("Missing <!DOCTYPE html>.", { fixHint: "Add <!DOCTYPE html> at the top of the document." }),

  favicon: ({ page }) => {
    const hasIcon = page.links.some((l) => (l.rel ?? "").includes("icon"));
    const hasApple = page.links.some((l) => (l.rel ?? "").includes("apple-touch-icon"));
    if (hasIcon && hasApple) return PASS("Favicon and Apple touch icon wired.");
    if (hasIcon) return MID("Favicon present but no apple-touch-icon.");
    return FAIL("No favicon link found.", { recommendedAction: "flag_only", fixHint: "Wire an existing icon asset via <link rel=\"icon\">." });
  },

  hreflang: ({ page }) => {
    const alts = page.links.filter((l) => l.rel === "alternate" && l.hreflang);
    if (alts.length === 0) return NA("No translated/locale routes detected, so hreflang does not apply.");
    const hasDefault = alts.some((l) => (l.hreflang ?? "").toLowerCase() === "x-default");
    if (!hasDefault) return MID(`${alts.length} hreflang annotations but no x-default.`);
    return PASS(`${alts.length} hreflang annotations including x-default.`);
  },

  "social-image-size": ({ page }) => {
    const img = page.metaByKey.get("og:image");
    if (!img) return NA("No og:image to validate.");
    const w = page.metaByKey.get("og:image:width");
    const h = page.metaByKey.get("og:image:height");
    if (/\.svg(\?|$)/i.test(img)) return FAIL("og:image is an SVG, which social platforms reject.", { evidence: img });
    if (!w || !h) return MID("og:image present but missing declared width/height.", { evidence: img });
    if (Number(w) >= 1200 && Number(h) >= 630) return PASS(`og:image is ${w}x${h}, fit for unfurling.`);
    return MID(`og:image is ${w}x${h}, below the recommended 1200x630.`, { evidence: img });
  },

  "markdown-twin": ({ twin }) => {
    if (!twin || !twin.twin.fetched || twin.twin.status === 0) {
      return FAIL("Could not reach a Markdown twin (<path>.md) for this page.", {
        recommendedAction: "add_page",
        recommendation:
          "Serve a faithful Markdown twin of each primary page at <path>.md (200, Content-Type text/markdown; charset=utf-8), built from the page's own content.",
        fixHint: "Add a .md route/handler that renders the same content as markdown.",
      });
    }
    const t = twin.twin;
    if (!t.ok) {
      return FAIL(`Markdown twin returned HTTP ${t.status} at ${twin.twinUrl}.`, {
        evidence: twin.twinUrl,
        recommendedAction: "add_page",
        recommendation: "Serve <path>.md with a 200 status for every primary page.",
      });
    }
    if (!t.nonEmpty) return MID("Markdown twin is reachable but the body is empty.", { evidence: twin.twinUrl });
    if (!t.isMarkdownType) {
      return MID(`Markdown twin served as "${t.contentType || "unknown"}" instead of text/markdown.`, {
        evidence: twin.twinUrl,
        fixHint: "Set Content-Type: text/markdown; charset=utf-8 on the .md response.",
      });
    }
    if (!t.charsetUtf8) {
      return MID(`Markdown twin served as text/markdown without charset=utf-8 ("${t.contentType}").`, {
        evidence: twin.twinUrl,
        fixHint: "Declare the charset: Content-Type: text/markdown; charset=utf-8 on the .md response.",
      });
    }
    return PASS(`Markdown twin present at ${twin.twinUrl} (text/markdown; charset=utf-8, non-empty).`, { evidence: twin.twinUrl });
  },

  "content-negotiation": ({ twin }) => {
    if (!twin) {
      return FAIL("Content negotiation for markdown was not detected.", {
        recommendedAction: "add_content",
        recommendation:
          "Serve the Markdown twin via content negotiation: requesting the HTML URL with Accept: text/markdown, or with an AI-bot User-Agent, should return markdown.",
      });
    }
    // Spec SHOULD (informational, never scored): an Accept matching neither
    // HTML nor markdown should get 406 Not Acceptable.
    const na = twin.notAcceptable;
    const naEvidence = !na.probed
      ? undefined
      : na.returns406
        ? "Spec SHOULD: unacceptable Accept correctly returns 406 Not Acceptable."
        : `Spec SHOULD (informational): unacceptable Accept returned HTTP ${na.status} (406 expected).`;
    const both = twin.acceptServesMarkdown && twin.botUaServesMarkdown;
    if (both) {
      return PASS("Accept: text/markdown and AI-bot User-Agents both receive the markdown twin.", {
        evidence: naEvidence,
      });
    }
    if (twin.acceptServesMarkdown || twin.botUaServesMarkdown) {
      const which = twin.acceptServesMarkdown ? "Accept: text/markdown" : "AI-bot User-Agent";
      return MID(`Only ${which} negotiation returns markdown; the other returns HTML.`, {
        recommendedAction: "add_content",
        evidence: naEvidence,
        fixHint: "Serve markdown for both Accept: text/markdown and known AI-bot User-Agents (GPTBot, ClaudeBot, PerplexityBot, ...).",
      });
    }
    return FAIL("The HTML URL never returns markdown to AI clients (no content negotiation).", {
      recommendedAction: "add_content",
      evidence: naEvidence,
      recommendation:
        "Add middleware that serves the markdown twin when the request prefers text/markdown or comes from an AI-bot User-Agent.",
    });
  },

  "ai-delivery-headers": ({ twin }) => {
    if (!twin || !twin.twin.ok) {
      return FAIL("No Markdown twin response to carry the AEO delivery headers.", {
        recommendedAction: "add_content",
        recommendation:
          "Once the twin is served, set X-Robots-Tag: noindex, Vary: Accept, and X-Markdown-Tokens on it, set Vary: Accept on the HTML, and advertise the twin via a Link rel=\"alternate\" response header on the HTML.",
      });
    }
    const signals: string[] = [];
    if (twin.twin.noindex) signals.push("X-Robots-Tag: noindex");
    if (twin.twin.varyAccept) signals.push("Vary: Accept (twin)");
    if (twin.twin.tokensHeader) signals.push("X-Markdown-Tokens");
    if (twin.htmlLinkAlternate) signals.push("Link rel=alternate (HTML)");
    if (twin.htmlVaryAccept) signals.push("Vary: Accept (HTML)");
    const total = 5;
    if (signals.length === total) return PASS(`All AEO delivery headers present: ${signals.join(", ")}.`);
    const missing = total - signals.length;
    if (signals.length >= 1) {
      return MID(`${signals.length}/${total} AEO delivery headers present (${missing} missing).`, {
        recommendedAction: "add_content",
        fixHint:
          "Markdown twin must send X-Robots-Tag: noindex, Vary: Accept, X-Markdown-Tokens; HTML must send Vary: Accept and Link: rel=\"alternate\"; type=\"text/markdown\" (both representations of the negotiated URL vary on Accept).",
      });
    }
    return FAIL("None of the AEO delivery headers are set on the twin or HTML response.", {
      recommendedAction: "add_content",
      recommendation:
        "Set X-Robots-Tag: noindex, Vary: Accept, X-Markdown-Tokens on the markdown twin, and Vary: Accept plus a Link rel=\"alternate\"; type=\"text/markdown\" header on the HTML.",
    });
  },

  "aeo-conformance": ({ twin, domain }) => {
    if (!twin || !twin.twin.ok) {
      return FAIL("No Markdown twin response to carry the AEO conformance extras.", {
        recommendedAction: "add_content",
        recommendation:
          "Fix markdown-twin first; then set X-Content-Type-Options: nosniff and X-AEO-Version on the twin response and include the .md twin URLs in sitemap.xml.",
      });
    }
    const signals: string[] = [];
    const missing: string[] = [];
    (twin.twin.nosniff ? signals : missing).push("X-Content-Type-Options: nosniff (twin)");
    (twin.twin.aeoVersion ? signals : missing).push("X-AEO-Version (twin)");
    // The sitemap signal is only assessable on a plain (non-index) sitemap;
    // a missing/invalid sitemap is the `sitemap` check's finding, not ours.
    const md = domain.sitemap.ok ? domain.sitemap.mdUrlCount : null;
    if (md !== null) ((md > 0) ? signals : missing).push(".md twin URLs in sitemap.xml");
    const total = signals.length + missing.length;
    if (missing.length === 0) return PASS(`All AEO conformance extras present: ${signals.join(", ")}.`);
    if (signals.length >= 1) {
      return MID(`${signals.length}/${total} AEO conformance extras present (missing: ${missing.join(", ")}).`, {
        recommendedAction: "add_content",
        fixHint:
          "Set X-Content-Type-Options: nosniff and X-AEO-Version: 1.0 on the markdown twin response, and list the .md twin URLs in sitemap.xml.",
      });
    }
    return FAIL(`None of the AEO conformance extras are present (missing: ${missing.join(", ")}).`, {
      recommendedAction: "add_content",
      recommendation:
        "Set X-Content-Type-Options: nosniff and X-AEO-Version: 1.0 where the markdown twin is served, and include the .md twin URLs in sitemap.xml.",
    });
  },

  "mobile-viewport": ({ page }) => {
    if (!page.viewport) return FAIL("No <meta name=\"viewport\"> tag.", { fixHint: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">." });
    if (!page.viewportResponsive) return MID("Viewport present but not responsive (no width=device-width).");
    if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(page.viewport)) return MID("Viewport disables zoom (accessibility issue).");
    return PASS("Responsive viewport meta present.");
  },
};

// --- the per-check activity --------------------------------------------------

const META_BY_NAME = new Map(check_intent.map((c) => [c.name, c]));

// Run one check. This is the unit Temporal will register as an activity.
export function runCheckActivity(name: string, ctx: CheckContext): CheckResultOut {
  const meta = META_BY_NAME.get(name);
  if (!meta) throw new Error(`Unknown check: ${name}`);

  const evaluator = EVALUATORS[name];
  const allowed = CONTENT_CHECK_PAGETYPES[name];
  let verdict: Verdict;
  if (allowed && !allowed.includes(ctx.pageType)) {
    verdict = {
      status: "NOT_APPLICABLE",
      summary: `${name} applies to content pages; this is a ${ctx.pageType} page.`,
      method: "heuristic",
      recommendedAction: "none",
    };
  } else if (evaluator) {
    verdict = safeEval(evaluator, ctx);
  } else {
    verdict = { status: "INCONCLUSIVE", summary: "No evaluator implemented yet.", method: "heuristic" };
  }

  const fraction =
    verdict.status === "SUCCESS" ? 1 : verdict.status === "MID" ? 0.5 : 0;
  const scored = verdict.status === "SUCCESS" || verdict.status === "MID" || verdict.status === "FAILED";

  return {
    name: meta.name,
    category: meta.category,
    tier: meta.tier,
    scope: meta.scope,
    fixableByAgent: meta.fixableByAgent,
    weight: meta.weight,
    status: verdict.status,
    pointsPossible: scored ? meta.weight : 0,
    pointsEarned: scored ? Math.round(meta.weight * fraction) : 0,
    summary: verdict.summary,
    evidence: verdict.evidence ?? null,
    fixHint: verdict.fixHint ?? null,
    recommendation: verdict.recommendation ?? null,
    recommendedAction: verdict.recommendedAction ?? (verdict.status === "SUCCESS" ? "none" : "flag_only"),
    method: verdict.method ?? "deterministic",
  };
}

function safeEval(fn: Evaluator, ctx: CheckContext): Verdict {
  try {
    return fn(ctx);
  } catch (err) {
    return {
      status: "INCONCLUSIVE",
      summary: `Check errored: ${err instanceof Error ? err.message : String(err)}`,
      method: "deterministic",
    };
  }
}

// First activity: does the provided repo build this website?
// Deterministic signal: the live host appears in the repo's config/source files.
export function repoWebsiteMatchActivity(
  url: URL,
  repo: RepoInput | null,
): RepoMatchOut {
  if (!repo) {
    return {
      status: "NOT_APPLICABLE",
      confidence: 0,
      method: "none",
      matchedSignals: [],
      evidence: null,
      recommendation: null,
    };
  }

  const host = url.hostname.replace(/^www\./, "");
  const signals: string[] = [];
  let evidence: string | null = null;

  for (const [path, content] of Object.entries(repo.files)) {
    if (content.includes(host)) {
      signals.push(`host "${host}" found in ${path}`);
      evidence ??= path;
    }
  }

  const confidence = Math.min(1, signals.length * 0.5);
  if (signals.length >= 1) {
    return { status: "SUCCESS", confidence, method: "deterministic", matchedSignals: signals, evidence, recommendation: null };
  }
  return {
    status: "FAILED",
    confidence: 0,
    method: "deterministic",
    matchedSignals: [],
    evidence: null,
    recommendation: `The repository "${repo.fullName}" does not reference ${host} in its config or source. Confirm this is the repository that builds the website.`,
  };
}

export const ALL_CHECK_NAMES = check_intent.map((c) => c.name);
