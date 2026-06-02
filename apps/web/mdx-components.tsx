import Link from "next/link"
import type { MDXComponents } from "mdx/types"
import type { ComponentPropsWithoutRef } from "react"

// Internal links route client-side; external links open safely. Typography for
// the rest of the elements comes from the <Prose> wrapper on the post page.
function MdxLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  if (href.startsWith("/")) {
    return <Link href={href} {...props} />
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
}

const components: MDXComponents = {
  a: MdxLink,
}

export function useMDXComponents(): MDXComponents {
  return components
}
