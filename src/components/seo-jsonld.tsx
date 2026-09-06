import { headers } from "next/headers";

// Renders JSON-LD structured data as an inline <script> carrying the request
// nonce, so the strict CSP (script-src 'self' 'nonce-...' 'strict-dynamic')
// lets it run. The nonce is minted per-request in src/proxy.ts and forwarded
// via the x-nonce request header.
export default async function JsonLd({ data }: { data: object }) {
  const h = await headers();
  const nonce = h.get("x-nonce") ?? "";
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}