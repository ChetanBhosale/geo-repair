# Product Hunt launch kit — GEO Repair

Copy-paste-ready assets for the Product Hunt launch. Keep every claim aligned
with the honesty guardrail: **we measure and improve technical readiness — we
never promise rankings or AI citations.**

---

## Name

**GEO Repair**

## Tagline (Product Hunt limit: 60 characters)

> Primary (53 chars):
**The free AI-search checkup that ships the fix as a PR**

Alternatives:
- `Score your site for AI search — then ship the fix as a PR` (56)
- `Free AI-search readiness checkup, fixed in a pull request` (57)
- `See if ChatGPT can read your site. Fix it in a PR.` (50)

## Description (Product Hunt limit: ~260 characters)

> GEO Repair scores any public site 0–100 on how ready it is for ChatGPT, Perplexity, and Google AI — with evidence for every issue, free and no signup. Want it fixed? Connect a repo and the agent opens a pull request you review and merge.

## Topics / categories

Primary: **SEO** · **Developer Tools**
Secondary: **Artificial Intelligence** · **Marketing**

## Links

- Website: https://geo.repair
- Free checkup: https://geo.repair/#checkup
- Blog: https://geo.repair/blog

---

## First comment (from the maker — pin this)

> Hey Product Hunt 👋
>
> We built GEO Repair because AI search broke a quiet assumption: that ranking on Google was enough. ChatGPT, Perplexity, Claude, and Google's AI Overviews don't read your site like a browser — they fetch raw HTML, parse its structure, and decide whether a page is clean enough to quote. A lot of great sites are invisible to them for boring, fixable reasons.
>
> So GEO Repair does two things:
>
> 1. **Checks** — point it at any public URL and get a 0–100 readiness score across 23 checks (rendering, crawl access, structured data, metadata, answer-first content, citations…), with evidence and a fix hint for each issue. Free, no signup, and it never touches your repo.
> 2. **Fixes** — connect a repository and the agent opens a pull request that closes those gaps. Everything is build- and type-checked in a sandbox first, and net-new content stays gated behind your approval. You review and merge — nothing ships without you.
>
> One thing we're deliberate about: we don't promise rankings or citations. No tool honestly can. We promise your site is measurably more ready to be fetched, parsed, and quoted — and we show you the score before and after.
>
> The checkup is free to try right now: https://geo.repair/#checkup
>
> We'd love your brutal feedback — especially on the checks themselves. What would you add to the rubric? — Chetan & Ajay

## Maker comment replies (prep)

- **"How is this different from an SEO audit?"** → Classic audits grade you for Google's ranking algorithm. We grade for *machine readability and quotability* by AI engines — and we don't stop at a report, we open the PR that fixes it.
- **"Do you guarantee I'll show up in ChatGPT?"** → No, and we'd distrust anyone who does. We make your pages clean and sourceable so you're not skipped for avoidable reasons. The score is the honest measure.
- **"Is my code safe?"** → The free checkup only reads public HTML. The fix runs in an ephemeral sandbox on the one repo you connect, opens a PR you review, and retains nothing. See https://geo.repair/security.
- **"What does it cost?"** → Checkup is free. The fix is a one-time charge sized by your sitemap: $49 (≤25 pages), $149 (≤100), $399 (≤250), custom beyond. You see the price before you pay.
- **"What stacks work?"** → Anything we can build in the sandbox — Next.js/React and similar. We confirm your stack is buildable before charging.

---

## Gallery shot list (1270×760, first image is the thumbnail)

1. **Hero / score** — A real readiness report: big 0–100 score dial + per-category subscores. Caption: *"A 0–100 readiness score for AI search — free, no signup."*
2. **Issue list** — The ranked findings with evidence + fix hint per check. Caption: *"23 checks across 7 categories, with evidence for every issue."*
3. **The pull request** — A GitHub PR opened by the agent, diff visible. Caption: *"Connect a repo and the agent opens the PR that fixes it."*
4. **Sandbox / safety** — Build + typecheck passing in the sandbox. Caption: *"Build- and type-checked before the PR. You review and merge."*
5. **Before / after** — Score before vs. after the merge. Caption: *"Measurably more ready — we show you the score, not a promise."*

GIF (optional, strongest first asset): URL in → score animates → issue list → PR opens. Keep under ~3 MB.

---

## Launch-day checklist

- [ ] Schedule for **12:01 AM PT** (Product Hunt's day starts on Pacific time).
- [ ] Tagline + description proofed against the character limits above.
- [ ] 5 gallery images exported at 1270×760; thumbnail legible at small size.
- [ ] Maker first comment drafted and ready to post the moment it goes live.
- [ ] Free checkup load-tested — expect a traffic spike to `/#checkup`.
- [ ] PostHog funnel events firing: checkup run → report viewed → repo connect.
- [ ] Footer + site socials live (LinkedIn, X) so visitors can follow.
- [ ] Hunter lined up (or self-hunt); notify your LinkedIn/X network at launch.
- [ ] Replies prepared for the FAQs above; founders watching comments all day.
- [ ] Cross-post: Show HN, relevant subreddits (r/SEO, r/SaaS), Indie Hackers, Dev.to.
