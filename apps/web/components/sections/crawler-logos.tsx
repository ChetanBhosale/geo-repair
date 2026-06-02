/* eslint-disable @next/next/no-img-element */
// Real brand marks from the loftlyy brand-asset CDN, saved under /public/logos.
// Rendered as decorative <img> (aria-hidden) so each keeps its true shape and
// color. Pass a height utility (e.g. "h-4 w-auto") to size them.

type P = { className?: string }

export function OpenAIGlyph({ className }: P) {
  return <img src="/logos/openai.svg" alt="" aria-hidden className={className} />
}

export function ClaudeGlyph({ className }: P) {
  return (
    <img src="/logos/anthropic.svg" alt="" aria-hidden className={className} />
  )
}

export function PerplexityGlyph({ className }: P) {
  return (
    <img src="/logos/perplexity.svg" alt="" aria-hidden className={className} />
  )
}

export function GoogleGlyph({ className }: P) {
  return <img src="/logos/google.svg" alt="" aria-hidden className={className} />
}
