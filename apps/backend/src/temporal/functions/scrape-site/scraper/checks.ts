// Check engine. One evaluator per canonical RUBRIC.md check (deterministic subset).
// IDs / categories / tiers / pillar membership are canonical in /RUBRIC.md + /scraper.md section 3.
//
// The four quality judgments (answerability, definitions, citation-quality, freshness-eeat)
// are LLM-assisted in the real product; here they run as transparent heuristics and say so in
// the reason. Everything else is fully deterministic header/DOM inspection.

import type {
  Category,
  CheckContext,
  CheckResult,
  PageType,
  Pillar,
  Priority,
  Status,
  Tier,
} from "./types.ts";

interface CheckMeta {
  id: string;
  category: Category;
  pillars: Pillar[];
  tier: Tier;
  fixableByAgent: boolean;
  priority: Priority;
  heuristic?: boolean; // true = LLM-assisted in prod, heuristic here
}

interface Verdict {
  status: Status;
  reason: string;
  good?: string[];
  bad?: string[];
  evidence?: string;
  fixHint?: string;
}

const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 30,
  high: 20,
  medium: 12,
  low: 6,
};

// --- small helpers ----------------------------------------------------------

// Authoritative outbound sources that signal citation quality. Beyond academia/government this
// includes web-standards bodies, official platform/developer documentation, and major research/
// analyst firms - the credible primary sources a real business or tech blog actually cites.
const TRUSTED_CITE_HOSTS: string[] = [
  // Government, academia, primary research
  "\\.gov", "\\.edu", "\\.gov\\.[a-z]{2}", "\\.ac\\.[a-z]{2}",
  "wikipedia\\.org", "doi\\.org", "arxiv\\.org", "nature\\.com",
  "nih\\.gov", "ncbi\\.nlm\\.nih\\.gov", "who\\.int", "oecd\\.org", "europa\\.eu",
  // Web standards / specifications
  "w3\\.org", "ietf\\.org", "rfc-editor\\.org", "whatwg\\.org", "iso\\.org",
  "ecma-international\\.org", "unicode\\.org",
  // Official platform / developer documentation
  "developer\\.mozilla\\.org", "developer\\.apple\\.com", "support\\.apple\\.com",
  "developers\\.google\\.com", "developer\\.android\\.com", "support\\.google\\.com",
  "learn\\.microsoft\\.com", "docs\\.microsoft\\.com", "web\\.dev",
  // Major research / analyst / data firms
  "pewresearch\\.org", "gartner\\.com", "forrester\\.com", "statista\\.com",
  "mckinsey\\.com", "hbr\\.org",
];
const TRUSTED_CITE = new RegExp(`(${TRUSTED_CITE_HOSTS.join("|")})([\\/:?#]|$)`, "i");

// Social network + share-button hosts. These are footer icons / "share on X" links, not
// citations, so citation-quality excludes them. (Share buttons point at these same hosts, e.g.
// facebook.com/sharer, twitter.com/intent, linkedin.com/share, so a host match catches both.)
const SOCIAL_HOST = /(twitter\.com|\/\/x\.com|\.x\.com|facebook\.com|fb\.com|linkedin\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com|pinterest\.com|threads\.net|mastodon|reddit\.com|t\.me|wa\.me|whatsapp\.com|snapchat\.com|discord\.(gg|com))/i;
const QUESTION_START = /^(how|what|why|when|where|who|which|can|is|are|does|do|should|will)\b/i;
const DATE_HINT = /\b(20\d{2}|19\d{2})\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i;

function sameOrigin(href: string, origin: string): boolean | null {
  if (!href) return null;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  try {
    const u = new URL(href, origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin === origin;
  } catch {
    return null;
  }
}

function looksAbsolute(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

// --- check registry ---------------------------------------------------------

export const CHECK_REGISTRY: CheckMeta[] = [
  { id: "ssr-visibility", category: "Rendering", pillars: ["geo"], tier: "out-of-scope", fixableByAgent: false, priority: "critical" },
  { id: "structured-data", category: "Structured data", pillars: ["geo", "aeo"], tier: "A", fixableByAgent: true, priority: "high" },
  { id: "meta-tags", category: "Metadata", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "high" },
  { id: "open-graph", category: "Metadata", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "medium" },
  { id: "canonical-urls", category: "Metadata", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "medium" },
  { id: "robots-ai-crawlers", category: "Crawl surface", pillars: ["geo"], tier: "A", fixableByAgent: true, priority: "high" },
  { id: "sitemap", category: "Crawl surface", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "medium" },
  { id: "llms-txt", category: "Crawl surface", pillars: ["geo"], tier: "A", fixableByAgent: true, priority: "medium" },
  { id: "semantic-html", category: "Semantics", pillars: ["seo", "geo", "aeo"], tier: "A", fixableByAgent: true, priority: "medium" },
  { id: "image-alt-text", category: "Semantics", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "internal-linking", category: "Content", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "answerability", category: "Answerability", pillars: ["aeo"], tier: "A", fixableByAgent: true, priority: "high", heuristic: true },
  { id: "freshness-eeat", category: "Content", pillars: ["geo", "aeo"], tier: "A", fixableByAgent: true, priority: "low", heuristic: true },
  { id: "interactive-labels", category: "Semantics", pillars: ["geo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "indexability", category: "Crawl surface", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "high" },
  { id: "citation-quality", category: "Content", pillars: ["aeo"], tier: "A", fixableByAgent: true, priority: "medium", heuristic: true },
  { id: "definitions", category: "Answerability", pillars: ["aeo"], tier: "A", fixableByAgent: true, priority: "medium", heuristic: true },
  { id: "charset", category: "Rendering", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "doctype", category: "Rendering", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "mobile-viewport", category: "Rendering", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "favicon", category: "Metadata", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "hreflang", category: "Metadata", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "social-image-size", category: "Metadata", pillars: ["seo"], tier: "A", fixableByAgent: true, priority: "low" },
  { id: "markdown-twins", category: "Content", pillars: ["geo"], tier: "B", fixableByAgent: true, priority: "low" },
];

// --- evaluators --------------------------------------------------------------

const EVALUATORS: Record<string, (ctx: CheckContext) => Verdict> = {
  "ssr-visibility": ({ page }) => {
    // Tier 0 raw HTML *is* the no-JS view. If primary content is absent here, AI crawlers miss it.
    if (page.spaRootDetected && page.wordCount < 100) {
      return {
        status: "fail",
        reason: "Raw HTML is nearly empty and looks like a client-rendered SPA shell, so AI crawlers that do not run JavaScript see almost no content.",
        bad: [`Only ${page.wordCount} words in no-JS HTML`, "SPA mount node detected (e.g. #root / #__next)"],
        evidence: `wordCount=${page.wordCount}, scripts=${page.scriptCount}, spaRoot=true`,
        fixHint: "Server-render or pre-render primary content so it is present in the initial HTML. CSR to SSR is flag-only (out of scope for the auto-fix agent).",
      };
    }
    if (page.wordCount < 250) {
      return {
        status: "partial",
        reason: "Some content is server-rendered but the no-JS HTML is thin, so part of the page may rely on hydration.",
        good: ["Content present in raw HTML"],
        bad: [`Low no-JS word count (${page.wordCount})`],
        evidence: `wordCount=${page.wordCount}`,
        fixHint: "Confirm the main content blocks render server-side, not only after client hydration.",
      };
    }
    return {
      status: "pass",
      reason: "Primary content is present in the raw no-JS HTML, so AI crawlers can read the page without executing JavaScript.",
      good: [`${page.wordCount} words visible in no-JS HTML`],
    };
  },

  "structured-data": ({ page }) => {
    if (page.jsonLd.length === 0) {
      return {
        status: "fail",
        reason: "No JSON-LD structured data found, so engines must infer entities from prose instead of reading explicit schema.",
        bad: ["No <script type=\"application/ld+json\"> blocks"],
        fixHint: "Add Organization + WebSite site-wide, Article on article routes, BreadcrumbList on nested pages. Real data only.",
      };
    }
    const invalid = page.jsonLd.filter((b) => !b.valid);
    const types = [...new Set(page.jsonLd.flatMap((b) => b.types))];
    if (invalid.length > 0) {
      return {
        status: "partial",
        reason: "Structured data is present but at least one JSON-LD block failed to parse, so engines may discard it.",
        good: types.length ? [`Types found: ${types.join(", ")}`] : [],
        bad: [`${invalid.length} invalid JSON-LD block(s)`],
        evidence: invalid[0]?.error ? `parse error: ${invalid[0].error}` : undefined,
        fixHint: "Fix the malformed JSON-LD so every block parses.",
      };
    }
    const hasFoundational = types.some((t) => /organization|website|webpage/i.test(t));
    if (!hasFoundational) {
      return {
        status: "partial",
        reason: "Valid JSON-LD is present but missing foundational Organization/WebSite schema.",
        good: [`Types found: ${types.join(", ")}`],
        bad: ["No Organization or WebSite schema"],
        fixHint: "Add Organization + WebSite schema site-wide.",
      };
    }
    return {
      status: "pass",
      reason: "Valid JSON-LD structured data is present with foundational schema types.",
      good: [`${page.jsonLd.length} valid block(s): ${types.join(", ")}`],
    };
  },

  "meta-tags": ({ page }) => {
    const title = page.title?.trim() ?? "";
    const desc = page.metaByKey.get("description")?.trim() ?? "";
    const good: string[] = [];
    const bad: string[] = [];
    if (title) good.push(`title present (${title.length} chars)`);
    else bad.push("missing <title>");
    if (desc) good.push(`description present (${desc.length} chars)`);
    else bad.push("missing meta description");

    if (!title || !desc) {
      return {
        status: "fail",
        reason: "Title or meta description is missing, the most basic discoverability signal for search and AI engines.",
        good,
        bad,
        evidence: `title="${title.slice(0, 60)}" descLen=${desc.length}`,
        fixHint: "Add a unique <title> (about 50 to 60 chars) and meta description (about 120 to 160 chars) per route.",
      };
    }
    // Generous, real-world tolerances: only flag lengths that genuinely truncate or read thin,
    // not every templated title. (Google shows ~60 chars but longer titles still work; a 70-180
    // char description is fine.) Present-and-non-placeholder is the core signal here.
    const titleOk = title.length >= 15 && title.length <= 80;
    const descOk = desc.length >= 70 && desc.length <= 200;
    if (titleOk && descOk) {
      return { status: "pass", reason: "Title and meta description are present and within healthy length ranges.", good };
    }
    if (!titleOk) bad.push(`title length ${title.length} outside 15 to 80 (may truncate in results)`);
    if (!descOk) bad.push(`description length ${desc.length} outside 70 to 200 (may truncate or read thin)`);
    return {
      status: "partial",
      reason: "Title and description exist but one or both fall outside the recommended length, risking SERP truncation or weak summaries.",
      good,
      bad,
      fixHint: "Tune lengths only by adding or trimming, never silently reword human-written copy.",
    };
  },

  "open-graph": ({ page }) => {
    const m = page.metaByKey;
    const core = ["og:title", "og:description", "og:url", "og:type", "og:image"];
    const present = core.filter((k) => m.has(k));
    const missing = core.filter((k) => !m.has(k));
    const twitterCard = m.get("twitter:card");
    const good: string[] = [];
    const bad: string[] = [];
    if (present.length) good.push(`og present: ${present.join(", ")}`);
    if (twitterCard) good.push(`twitter:card=${twitterCard}`);
    if (missing.length) bad.push(`og missing: ${missing.join(", ")}`);
    if (!twitterCard) bad.push("missing twitter:card");

    if (present.length === 0) {
      return {
        status: "fail",
        reason: "No Open Graph tags found, so shared links and AI previews have no controlled title, description, or image.",
        bad,
        fixHint: "Add core og:* tags plus twitter:card. Use a correct og:type (website, article, or product).",
      };
    }
    if (missing.length > 0 || !twitterCard) {
      return {
        status: "partial",
        reason: "Open Graph is partially configured but missing some core tags or Twitter card data.",
        good,
        bad,
        fixHint: "Complete the core og:* set, add og:image:alt, and a twitter:card value.",
      };
    }
    return { status: "pass", reason: "Open Graph and Twitter card tags are complete.", good };
  },

  "canonical-urls": ({ page, domain }) => {
    if (!page.canonical) {
      return {
        status: "fail",
        reason: "No canonical link found, so engines may pick the wrong URL or split ranking signals across duplicates.",
        bad: ["missing <link rel=\"canonical\">"],
        fixHint: "Add a self-referential absolute canonical per route.",
      };
    }
    const abs = looksAbsolute(page.canonical);
    let selfRef: boolean | null = null;
    try {
      const c = new URL(page.canonical, domain.origin);
      const f = new URL(page.finalUrl);
      selfRef = c.origin + c.pathname.replace(/\/$/, "") === f.origin + f.pathname.replace(/\/$/, "");
    } catch {
      selfRef = null;
    }
    if (!abs) {
      return {
        status: "partial",
        reason: "A canonical exists but is not an absolute URL, which is less robust across origins.",
        good: ["canonical present"],
        bad: ["canonical is relative"],
        evidence: page.canonical,
        fixHint: "Use an absolute https canonical URL.",
      };
    }
    if (selfRef === false) {
      return {
        status: "partial",
        reason: "Canonical points to a different URL than this page, which can deindex the page if unintended.",
        good: ["absolute canonical present"],
        bad: ["canonical is not self-referential"],
        evidence: `canonical=${page.canonical}`,
        fixHint: "Confirm the cross-canonical is intentional, otherwise make it self-referential.",
      };
    }
    return { status: "pass", reason: "Self-referential absolute canonical is present.", good: [`canonical=${page.canonical}`] };
  },

  "robots-ai-crawlers": ({ domain }) => {
    if (!domain.robots.fetched) {
      return {
        status: "partial",
        reason: "No robots.txt was found. AI crawlers are not blocked by default, but an explicit allow plus sitemap reference is recommended.",
        bad: ["no robots.txt"],
        fixHint: "Add robots.txt that allows AI crawlers and references the sitemap.",
      };
    }
    const blocked = domain.robots.aiCrawlerRules.filter((r) => r.blocked);
    if (blocked.length > 0) {
      return {
        status: "fail",
        reason: "robots.txt disallows one or more AI crawlers at the site root, making the site invisible to those engines.",
        bad: [`blocked: ${blocked.map((b) => b.agent).join(", ")}`],
        evidence: `${blocked.length} AI agent(s) disallowed in robots.txt`,
        fixHint: "Remove the disallow for GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc. Preserve intentional blocks.",
      };
    }
    return {
      status: "pass",
      reason: "robots.txt does not block known AI crawlers.",
      good: ["GPTBot, ClaudeBot, PerplexityBot, Google-Extended and others are allowed"],
    };
  },

  sitemap: ({ domain }) => {
    if (!domain.sitemap.ok) {
      return {
        status: "fail",
        reason: "No valid XML sitemap was found, so engines have no canonical list of pages to crawl.",
        bad: [domain.sitemap.fetched ? `sitemap not valid XML (status ${domain.sitemap.status})` : "no sitemap.xml"],
        fixHint: "Publish a valid sitemap.xml and reference it from robots.txt.",
      };
    }
    const good = [`sitemap valid with ${domain.sitemap.urlCount} URL(s)`];
    if (!domain.sitemap.referencedInRobots) {
      return {
        status: "partial",
        reason: "A valid sitemap exists but is not referenced from robots.txt, so some crawlers may not discover it.",
        good,
        bad: ["sitemap not referenced in robots.txt"],
        fixHint: "Add a Sitemap: line to robots.txt.",
      };
    }
    return { status: "pass", reason: "Valid sitemap is present and referenced from robots.txt.", good };
  },

  "llms-txt": ({ domain }) => {
    if (!domain.llmsTxt.ok || !domain.llmsTxt.nonEmpty) {
      return {
        status: "fail",
        reason: "No /llms.txt found. This emerging file gives AI engines a curated map of key pages.",
        bad: ["missing or empty /llms.txt"],
        fixHint: "Publish /llms.txt (Markdown) with site name, description, and curated key-page links.",
      };
    }
    if (!domain.llmsTxt.hasLinks) {
      return {
        status: "partial",
        reason: "/llms.txt exists but has no Markdown links to key pages.",
        good: ["/llms.txt present"],
        bad: ["no curated links"],
        fixHint: "Add curated Markdown links to the most important pages.",
      };
    }
    return { status: "pass", reason: "/llms.txt is present with curated links.", good: ["/llms.txt present with links"] };
  },

  "semantic-html": ({ page }) => {
    const h1s = page.headings.filter((h) => h.level === 1);
    const good: string[] = [];
    const bad: string[] = [];
    const lm = page.landmarks;
    const landmarkList = Object.entries(lm).filter(([, v]) => v).map(([k]) => k);
    if (landmarkList.length) good.push(`landmarks: ${landmarkList.join(", ")}`);
    const missingLandmarks = Object.entries(lm).filter(([, v]) => !v).map(([k]) => k);
    if (missingLandmarks.length) bad.push(`missing landmarks: ${missingLandmarks.join(", ")}`);

    // heading hierarchy: no jump greater than 1 level deeper
    let jump = false;
    let prev = 0;
    for (const h of page.headings) {
      if (prev && h.level > prev + 1) jump = true;
      prev = h.level;
    }

    if (h1s.length === 1) good.push("exactly one <h1>");
    else if (h1s.length === 0) bad.push("no <h1>");
    else bad.push(`${h1s.length} <h1> elements`);
    if (jump) bad.push("heading levels skip (e.g. h2 to h4)");

    if (h1s.length === 1 && !jump && lm.main) {
      return { status: "pass", reason: "Single H1, sound heading hierarchy, and a <main> landmark are present.", good };
    }
    if (h1s.length === 0 || (!lm.main && !lm.header)) {
      return {
        status: "fail",
        reason: "Core semantic structure is missing (no single H1 or no main/header landmark), which weakens the machine-readable outline.",
        good,
        bad,
        fixHint: "Use one <h1>, a correct heading hierarchy, and landmark elements (header, nav, main, footer).",
      };
    }
    return {
      status: "partial",
      reason: "Semantic structure is mostly present but has gaps in heading hierarchy or landmarks.",
      good,
      bad,
      fixHint: "Resolve heading skips and add missing landmarks. Text-preserving structural fixes only.",
    };
  },

  "image-alt-text": ({ page }) => {
    const content = page.images.filter((img) => !img.ariaHidden && img.role !== "presentation");
    if (content.length === 0) {
      return { status: "not-applicable", reason: "No content images to evaluate for alt text." };
    }
    const missing = content.filter((img) => img.alt === null);
    const good = [`${content.length - missing.length}/${content.length} content images have alt`];
    if (missing.length === 0) {
      return { status: "pass", reason: "All content images have an alt attribute.", good };
    }
    const ratio = missing.length / content.length;
    return {
      status: ratio > 0.5 ? "fail" : "partial",
      reason: "Some content images are missing alt text, so their meaning is lost to screen readers and AI agents.",
      good,
      bad: [`${missing.length} image(s) missing alt`],
      evidence: missing[0]?.src ? `e.g. ${missing[0].src}` : undefined,
      fixHint: "Add accurate alt for meaningful images, alt=\"\" for decorative ones. No keyword stuffing.",
    };
  },

  "internal-linking": ({ page, domain }) => {
    const internal = page.anchors.filter((a) => sameOrigin(a.href, domain.origin) === true);
    if (internal.length === 0) {
      return {
        status: "fail",
        reason: "No internal links found, which suggests an orphan page or navigation that is not crawlable in raw HTML.",
        bad: ["no internal links in HTML"],
        fixHint: "Add descriptive internal links to related pages.",
      };
    }
    const vague = internal.filter((a) => {
      const t = (a.ariaLabel || a.text || "").trim().toLowerCase();
      return t === "" || ["click here", "here", "read more", "learn more", "this", "link"].includes(t);
    });
    // links with no accessible text at all (and no aria-label, not just an image)
    const empty = vague.filter((a) => !a.ariaLabel && !a.text && !a.imgAlt);
    const good = [`${internal.length} internal link(s)`];
    if (vague.length === 0) {
      return { status: "pass", reason: "Internal links use descriptive anchor text.", good };
    }
    return {
      status: empty.length > 0 || vague.length / internal.length > 0.3 ? "partial" : "pass",
      reason: "Internal linking exists but some anchors use vague or empty text, which weakens topical signals.",
      good,
      bad: [`${vague.length} vague anchor(s) (e.g. "click here", "read more")`],
      fixHint: "Replace vague anchor text with descriptive labels. Ensure no orphan pages.",
    };
  },

  answerability: ({ page }) => {
    const hasFaqSchema = page.jsonLd.some((b) => b.types.some((t) => /faqpage|qapage/i.test(t)));
    const questionHeads = page.headings.filter((h) => h.text.trim().endsWith("?") || QUESTION_START.test(h.text.trim()));
    const good: string[] = [];
    const bad: string[] = [];
    if (hasFaqSchema) good.push("FAQPage/QAPage schema present");
    if (questionHeads.length) good.push(`${questionHeads.length} question-shaped heading(s)`);
    const note = "Heuristic check (LLM-assisted in production).";

    if (hasFaqSchema && questionHeads.length > 0) {
      return { status: "pass", reason: `Question-shaped headings and FAQ schema make answers easy to extract. ${note}`, good };
    }
    if (questionHeads.length >= 2) {
      return {
        status: "partial",
        reason: `Question-shaped headings exist but no FAQPage schema marks them up for answer engines. ${note}`,
        good,
        bad: ["no FAQPage schema"],
        fixHint: "Add FAQPage schema where Q&A already renders. Net-new FAQ authoring is gated (Tier C).",
      };
    }
    return {
      status: "fail",
      reason: `No question-shaped headings or FAQ structure found, so answer engines have little to quote directly. ${note}`,
      bad,
      fixHint: "Surface question-and-answer structure where it fits. Net-new FAQ content is gated (Tier C).",
    };
  },

  "freshness-eeat": ({ page, domain }) => {
    const hasDate = DATE_HINT.test(page.visibleText.slice(0, 4000)) ||
      page.metaByKey.has("article:published_time") ||
      page.metaByKey.has("article:modified_time");
    const hasAuthor = page.metaByKey.has("author") ||
      page.metaByKey.has("article:author") ||
      page.jsonLd.some((b) => b.raw.toLowerCase().includes('"author"'));
    const hasAboutContact = page.anchors.some((a) => /\/(about|contact)(\/|$|#)/i.test(a.href));
    const good: string[] = [];
    const bad: string[] = [];
    if (hasDate) good.push("visible/declared date"); else bad.push("no visible date");
    if (hasAuthor) good.push("author signal"); else bad.push("no author signal");
    if (hasAboutContact) good.push("about/contact link"); else bad.push("no about/contact link");
    const note = "Heuristic check (LLM-assisted in production).";
    const score = [hasDate, hasAuthor, hasAboutContact].filter(Boolean).length;
    if (score >= 2) return { status: "pass", reason: `Freshness and authorship signals are present. ${note}`, good, bad };
    if (score === 1) return { status: "partial", reason: `Some E-E-A-T signals present but key ones are missing. ${note}`, good, bad, fixHint: "Surface visible dates, author, and about/contact where derivable." };
    void domain;
    return { status: "fail", reason: `No date, author, or about/contact signals found, weakening trust signals. ${note}`, bad, fixHint: "Add visible published/updated dates and author/about info." };
  },

  "interactive-labels": ({ page }) => {
    const controls = page.interactives.filter((c) => !c.disabled);
    if (controls.length === 0) {
      return { status: "not-applicable", reason: "No interactive controls found in raw HTML to evaluate." };
    }
    const unnamed = controls.filter((c) => !c.ariaHidden && !c.accessibleName);
    const hiddenFocusable = controls.filter((c) => c.ariaHidden);
    const good = [`${controls.length - unnamed.length}/${controls.length} controls have an accessible name`];
    const bad: string[] = [];
    if (unnamed.length) bad.push(`${unnamed.length} control(s) without accessible name`);
    if (hiddenFocusable.length) bad.push(`${hiddenFocusable.length} focusable control(s) aria-hidden`);
    if (unnamed.length === 0 && hiddenFocusable.length === 0) {
      return { status: "pass", reason: "Every interactive control exposes an accessible name. This is the machine-eye view AI agents use to operate the page.", good };
    }
    return {
      status: unnamed.length / controls.length > 0.4 ? "fail" : "partial",
      reason: "Some interactive controls lack an accessible name, so AI agents and assistive tech cannot reliably operate them.",
      good,
      bad,
      fixHint: "Give every button, link, and input a programmatic accessible name. Do not hide focusable controls from the a11y tree.",
    };
  },

  indexability: ({ page }) => {
    const metaRobots = (page.metaRobots ?? "").toLowerCase();
    const xRobots = (page.xRobotsTag ?? "").toLowerCase();
    const bad: string[] = [];
    const good: string[] = [];
    const noindex = metaRobots.includes("noindex") || xRobots.includes("noindex");
    if (page.status !== 200) bad.push(`HTTP status ${page.status}`);
    if (noindex) bad.push(`noindex via ${metaRobots.includes("noindex") ? "meta robots" : "X-Robots-Tag"}`);
    if (!noindex && page.status === 200) good.push("no noindex, 200 OK");

    const verification = page.metaByKey.has("google-site-verification") || page.metaByKey.has("msvalidate.01");
    if (noindex || page.status !== 200) {
      return {
        status: "fail",
        reason: "The page is not eligible for search indexing (noindex directive or non-200 status), which also removes it from Google AI Overviews.",
        good,
        bad,
        evidence: noindex ? `robots="${metaRobots || xRobots}"` : `status=${page.status}`,
        fixHint: "Remove accidental noindex on primary content. Preserve intentional noindex on staging/private routes.",
      };
    }
    return {
      status: "pass",
      reason: "The page is eligible for indexing (200 OK, no noindex).",
      good: verification ? [...good, "search-console verification meta present (advisory)"] : good,
    };
  },

  "citation-quality": ({ page, domain }) => {
    // Any outbound link to another site counts as a citation, regardless of TLD or source - we do
    // NOT require an academic/.gov source. But social + share links (footer icons, "share on X"
    // buttons) are not citations, so they are excluded, and a page needs at least two real
    // outbound references to pass. We still highlight links to recognised authorities as a bonus.
    const external = page.anchors.filter((a) => sameOrigin(a.href, domain.origin) === false && looksAbsolute(a.href));
    const citations = external.filter((a) => !SOCIAL_HOST.test(a.href));
    const authoritative = citations.filter((a) => TRUSTED_CITE.test(a.href));
    const note = "Heuristic check (LLM-assisted in production); never a citation promise.";
    const good: string[] = [];
    if (citations.length) good.push(`${citations.length} outbound citation(s) to other sites`);
    if (authoritative.length) good.push(`${authoritative.length} to recognised authoritative sources (docs, standards, research, .gov/.edu)`);

    if (citations.length >= 2) {
      const bonus = authoritative.length ? " Some point to recognised authorities." : "";
      return { status: "pass", reason: `Page backs its claims with multiple outbound citations.${bonus} ${note}`, good };
    }
    if (citations.length === 1) {
      return { status: "partial", reason: `The page links to a single external source. A couple more references would strengthen its citation-readiness. ${note}`, good, bad: ["only one outbound citation (social/share links not counted)"], fixHint: "Where the prose names a source or statistic, link out to it." };
    }
    return { status: "fail", reason: `The page makes claims without citing any external source (social and share links are not counted). ${note}`, bad: ["no outbound citations"], fixHint: "Where the prose names a source or statistic, link out to it." };
  },

  definitions: ({ page }) => {
    const note = "Heuristic check (LLM-assisted in production).";
    const hasDefinedTerm = page.jsonLd.some((b) => b.types.some((t) => /definedterm/i.test(t)));
    // A definition-shaped heading, e.g. "What is X?" / "What are X?". Glossary entries use these.
    const defHeading = page.headings.some((h) => /^\s*what\s+(is|are|do|does)\b/i.test(h.text.trim()));
    // Answer-first: an "X is/are/means/refers to/stands for Y" pattern near the top of the body.
    // Widened from 400 to 600 chars because nav/breadcrumb text often precedes the real lead.
    const lead = page.visibleText.slice(0, 600);
    const definitional = /\b[A-Z][\w-]+(?:\s+[\w-]+){0,5}\s+(is|are|refers to|means|stands for)\b/.test(lead);
    const good: string[] = [];
    if (hasDefinedTerm) good.push("DefinedTerm schema present");
    if (defHeading) good.push('definition-shaped heading present (e.g. "What is ...")');
    if (definitional) good.push("answer-first definitional lead detected");

    // DefinedTerm schema is the explicit, machine-readable end state this check rewards: pass outright.
    if (hasDefinedTerm) {
      return { status: "pass", reason: `Defined terms are marked up with DefinedTerm schema, so answer engines can extract the definition directly. ${note}`, good };
    }
    // A clear definitional lead or heading, just no schema yet: partial (the agent can add the markup).
    if (definitional || defHeading) {
      return { status: "partial", reason: `Content is answer-first/definitional but does not mark up defined terms with schema. ${note}`, good, bad: ["no DefinedTerm markup"], evidence: lead.slice(0, 120).trim() || undefined, fixHint: "Mark up the existing definition with DefinedTerm schema. Net-new definitions are gated (Tier C)." };
    }
    return { status: "fail", reason: `Content does not lead with a plain definition or answer, which top studies link to AI quoting. ${note}`, bad: ["no answer-first definition detected"], fixHint: "Surface an existing definition to the top of its section. Net-new copy is gated (Tier C)." };
  },

  charset: ({ page }) => {
    if (!page.charsetValue) {
      return { status: "fail", reason: "No character encoding declared, which risks mojibake across languages.", bad: ["no <meta charset>"], fixHint: "Add <meta charset=\"utf-8\"> early in <head>." };
    }
    const utf8 = /utf-?8/i.test(page.charsetValue);
    if (utf8 && page.charsetEarly) {
      return { status: "pass", reason: "UTF-8 charset is declared early in <head>.", good: [`charset=${page.charsetValue}`] };
    }
    return {
      status: "partial",
      reason: page.charsetEarly ? "A non-UTF-8 charset is declared." : "Charset is declared but not within the first 1024 bytes of <head>.",
      good: [`charset=${page.charsetValue}`],
      bad: page.charsetEarly ? ["charset is not utf-8"] : ["charset declared late"],
      fixHint: "Declare <meta charset=\"utf-8\"> as the first element in <head>.",
    };
  },

  doctype: ({ page }) => {
    if (page.hasDoctype) {
      return { status: "pass", reason: "HTML5 doctype is present, so the browser renders in standards mode.", good: ["<!DOCTYPE html> present"] };
    }
    return { status: "fail", reason: "No HTML5 doctype found, so the browser may use quirks mode.", bad: ["missing <!DOCTYPE html>"], fixHint: "Add <!DOCTYPE html> as the first line of the document." };
  },

  "mobile-viewport": ({ page }) => {
    if (!page.viewport) {
      return {
        status: "fail",
        reason: "No viewport meta tag found, so the page is not mobile-friendly and mobile-first indexing is penalized.",
        bad: ["missing <meta name=\"viewport\">"],
        fixHint: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to <head>.",
      };
    }
    if (!page.viewportResponsive) {
      return {
        status: "partial",
        reason: "A viewport meta tag exists but does not set width=device-width, so layout may not adapt to mobile screens.",
        good: ["viewport meta present"],
        bad: ["viewport missing width=device-width"],
        evidence: `content="${page.viewport}"`,
        fixHint: "Set content to include width=device-width, initial-scale=1.",
      };
    }
    const scaleLocked = /(user-scalable\s*=\s*(no|0))|maximum-scale\s*=\s*1(\.0)?\b/i.test(page.viewport);
    if (scaleLocked) {
      return {
        status: "partial",
        reason: "Viewport is responsive but disables user zoom, which is a WCAG accessibility failure.",
        good: ["responsive width=device-width"],
        bad: ["zoom disabled (user-scalable=no / maximum-scale=1)"],
        evidence: `content="${page.viewport}"`,
        fixHint: "Remove user-scalable=no and maximum-scale caps so users can zoom.",
      };
    }
    return {
      status: "pass",
      reason: "Responsive viewport meta tag is present and allows zoom.",
      good: [`content="${page.viewport}"`],
    };
  },

  favicon: ({ page }) => {
    const icon = page.links.find((l) => /(^|\s)(icon|shortcut icon)(\s|$)/i.test(l.rel ?? ""));
    const apple = page.links.find((l) => /apple-touch-icon/i.test(l.rel ?? ""));
    const good: string[] = [];
    const bad: string[] = [];
    if (icon) good.push("favicon linked"); else bad.push("no <link rel=icon>");
    if (apple) good.push("apple-touch-icon linked"); else bad.push("no apple-touch-icon");
    if (icon && apple) return { status: "pass", reason: "Favicon and Apple touch icon are wired.", good };
    if (icon || apple) return { status: "partial", reason: "A favicon link exists but one icon variant is missing.", good, bad, fixHint: "Wire both <link rel=icon> and apple-touch-icon to existing assets." };
    return { status: "fail", reason: "No favicon or touch icon linked, a small but visible branding/trust gap.", bad, fixHint: "Wire existing icon assets. Flag only if no asset exists (never generate imagery)." };
  },

  hreflang: ({ page }) => {
    const tags = page.links.filter((l) => l.rel?.toLowerCase().includes("alternate") && l.hreflang);
    if (tags.length === 0) {
      return { status: "not-applicable", reason: "No alternate-locale routes detected, so hreflang does not apply." };
    }
    const hasXDefault = tags.some((t) => t.hreflang?.toLowerCase() === "x-default");
    if (hasXDefault) {
      return { status: "pass", reason: "hreflang annotations are present with an x-default fallback.", good: [`${tags.length} hreflang tag(s) incl. x-default`] };
    }
    return { status: "partial", reason: "hreflang tags exist but no x-default is declared.", good: [`${tags.length} hreflang tag(s)`], bad: ["no x-default"], fixHint: "Add an x-default hreflang entry." };
  },

  "social-image-size": ({ page }) => {
    const img = page.metaByKey.get("og:image") || page.metaByKey.get("twitter:image");
    if (!img) {
      return { status: "fail", reason: "No social image declared, so shared links unfurl without a preview image.", bad: ["no og:image / twitter:image"], fixHint: "Wire an existing image at >=1200x630 (PNG/JPG/WebP, not SVG)." };
    }
    if (/\.svg(\?|#|$)/i.test(img)) {
      return { status: "fail", reason: "The social image is an SVG, which Facebook and Twitter reject for unfurls.", bad: ["og:image is SVG"], evidence: img, fixHint: "Use a raster format (PNG/JPG/WebP)." };
    }
    const w = parseInt(page.metaByKey.get("og:image:width") ?? "", 10);
    const h = parseInt(page.metaByKey.get("og:image:height") ?? "", 10);
    if (Number.isFinite(w) && Number.isFinite(h)) {
      if (w >= 1200 && h >= 630) {
        return { status: "pass", reason: "Social image is declared at recommended dimensions (>=1200x630).", good: [`${w}x${h}`] };
      }
      return { status: "partial", reason: "Social image dimensions are declared but below the recommended 1200x630.", good: [`${w}x${h} declared`], bad: ["below 1200x630"], fixHint: "Use an image at least 1200x630." };
    }
    return {
      status: "partial",
      reason: "A social image is wired but its dimensions are not declared, so unfurl quality cannot be verified from markup alone.",
      good: ["og:image present"],
      bad: ["og:image:width / og:image:height not declared"],
      evidence: img,
      fixHint: "Declare og:image:width, og:image:height, and og:image:type.",
    };
  },

  "markdown-twins": ({ twin }) => {
    if (!twin.attempted || (twin.error && !twin.reachable)) {
      return { status: "fail", reason: "No Markdown twin found for this page, so AI engines must parse the JS-heavy HTML instead of clean Markdown.", bad: [twin.error ? `twin fetch error: ${twin.error}` : `no twin at ${twin.mdUrl}`], evidence: twin.mdUrl, fixHint: "Serve a faithful Markdown twin at <path>.md, link it via rel=alternate, and index it in /llms.txt." };
    }
    if (!twin.reachable) {
      return { status: "fail", reason: "The Markdown twin URL is not reachable, so there is no clean machine-readable copy of the page.", bad: [`${twin.mdUrl} returned ${twin.status}`], evidence: twin.mdUrl, fixHint: "Serve <path>.md with Content-Type text/markdown." };
    }
    const good: string[] = ["twin reachable (200)"];
    const bad: string[] = [];
    if (twin.contentTypeMarkdown) good.push("text/markdown content-type"); else bad.push("wrong content-type");
    if (twin.nonEmptyBody) good.push("non-empty body"); else bad.push("empty body");
    if (twin.linkAlternate) good.push("HTML advertises twin (rel=alternate)"); else bad.push("HTML missing rel=alternate link");
    if (twin.varyAccept) good.push("Vary: Accept"); else bad.push("missing Vary: Accept");
    if (twin.acceptNegotiation) good.push("Accept negotiation works"); else bad.push("no Accept negotiation");
    if (!twin.noindex) bad.push("twin missing X-Robots-Tag: noindex");

    // Core "exists + usable" vs full conformance.
    const fullyConformant = twin.contentTypeMarkdown && twin.nonEmptyBody && twin.linkAlternate && twin.acceptNegotiation && twin.varyAccept;
    if (fullyConformant) {
      return { status: "pass", reason: "A discoverable, well-formed Markdown twin is served with correct content negotiation.", good };
    }
    return {
      status: "partial",
      reason: "A Markdown twin exists but is missing some discovery or header conventions, so engines may not find or trust it.",
      good,
      bad,
      evidence: twin.mdUrl,
      fixHint: "Add rel=alternate discovery, Vary: Accept, X-Robots-Tag: noindex, and Accept negotiation. dualmark adapters (Next/Astro/SvelteKit) implement this.",
    };
  },
};

/**
 * Page-type applicability. Checks NOT listed here apply to every page type. Checks listed here
 * apply ONLY to the page types in their set; on any other page type they return `not-applicable`
 * (excluded from the denominator, never scored as a fail).
 *
 * Rationale (RUBRIC.md honesty rule): a Terms-of-Service or pricing page is not supposed to be an
 * FAQ or a definitional article, so failing it on answerability is a false negative. We score
 * "does the site have answer-ready content where it should," not "does every page have an FAQ."
 */
const ANSWER_CONTENT_TYPES: ReadonlySet<PageType> = new Set<PageType>([
  "article",
  "listing",
  "documentation",
  "generic", // homepage / about can reasonably carry definitions + answers
]);

const CHECK_APPLICABILITY: Record<string, ReadonlySet<PageType>> = {
  answerability: ANSWER_CONTENT_TYPES,
  definitions: ANSWER_CONTENT_TYPES,
  "citation-quality": ANSWER_CONTENT_TYPES,
};

/** True if a check applies to the given page type. Unlisted checks always apply. */
function appliesTo(checkId: string, pageType: PageType): boolean {
  const allowed = CHECK_APPLICABILITY[checkId];
  return allowed ? allowed.has(pageType) : true;
}

/** Run every registered check against the context. Pure + deterministic for non-heuristic checks. */
export function runChecks(ctx: CheckContext): CheckResult[] {
  return CHECK_REGISTRY.map((meta) => {
    // Page-type gating: skip (not-applicable) checks that do not apply to this page type.
    if (!appliesTo(meta.id, ctx.pageType)) {
      return {
        id: meta.id,
        category: meta.category,
        pillars: meta.pillars,
        tier: meta.tier,
        fixableByAgent: meta.fixableByAgent,
        weight: PRIORITY_WEIGHT[meta.priority],
        status: "not-applicable" as Status,
        reason: `Not applicable to a ${ctx.pageType} page (this check targets answer/definition content).`,
        good: [],
        bad: [],
        evidence: null,
        fixHint: null,
      };
    }

    const evaluator = EVALUATORS[meta.id];
    const verdict: Verdict = evaluator
      ? evaluator(ctx)
      : { status: "inconclusive", reason: "No evaluator implemented." };
    return {
      id: meta.id,
      category: meta.category,
      pillars: meta.pillars,
      tier: meta.tier,
      fixableByAgent: meta.fixableByAgent,
      weight: PRIORITY_WEIGHT[meta.priority],
      status: verdict.status,
      reason: verdict.reason,
      good: verdict.good ?? [],
      bad: verdict.bad ?? [],
      evidence: verdict.evidence ?? null,
      fixHint: verdict.fixHint ?? null,
    };
  });
}
