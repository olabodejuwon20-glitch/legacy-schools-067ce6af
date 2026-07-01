import { Helmet } from "react-helmet-async";

/** Emit a JSON-LD block into <head>. Pass any schema.org object. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Helmet>
  );
}

export function BreadcrumbLd({ items, site = "https://legacy-skool.lovable.app" }: { items: { name: string; path: string }[]; site?: string }) {
  return (
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: `${site}${it.path}`,
      })),
    }} />
  );
}

export function FaqLd({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    }} />
  );
}