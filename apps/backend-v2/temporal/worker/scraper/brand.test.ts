import { describe, expect, test } from "bun:test";

import { parsePage } from "./parser";
import { detectBrandIdentity } from "./brand";
import type { RawFetch } from "./fetcher";

function page(html: string, finalUrl = "https://example.com/") {
  return parsePage({
    requestedUrl: finalUrl,
    finalUrl,
    status: 200,
    ok: true,
    headers: {},
    contentType: "text/html",
    body: html,
    byteLength: html.length,
  } satisfies RawFetch);
}

describe("brand identity detection", () => {
  test("resolves favicon and JSON-LD logo URLs against the scanned page", () => {
    const model = page(`
      <!doctype html>
      <html>
        <head>
          <title>Acme</title>
          <meta property="og:site_name" content="Acme Site">
          <link rel="icon" href="/favicon.svg" sizes="32x32">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Acme Inc",
              "logo": { "url": "/logo.png" }
            }
          </script>
        </head>
        <body><main>Acme homepage</main></body>
      </html>
    `);

    expect(detectBrandIdentity(model)).toEqual({
      name: "Acme Inc",
      faviconUrl: "https://example.com/favicon.svg",
      logoUrl: "https://example.com/logo.png",
    });
  });

  test("uses apple touch icon as logo fallback", () => {
    const model = page(`
      <!doctype html>
      <html>
        <head>
          <link rel="apple-touch-icon" href="/apple.png" sizes="180x180">
        </head>
        <body><main>Example</main></body>
      </html>
    `);

    expect(detectBrandIdentity(model)).toEqual({
      name: null,
      faviconUrl: "https://example.com/favicon.ico",
      logoUrl: "https://example.com/apple.png",
    });
  });
});
