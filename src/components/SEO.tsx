import { Helmet } from "react-helmet-async";

type Props = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  noindex?: boolean;
};

const SITE = "https://legacy-skool.lovable.app";

/** Per-route head tags. Emits self-referencing canonical + matching og:url/title/desc. */
export default function SEO({ title, description, path, type = "website", image, noindex }: Props) {
  const clean = (() => {
    const p = (path || "/").split("?")[0].split("#")[0];
    return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
  })();
  const url = `${SITE}${clean}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {image ? <meta property="og:image" content={image} /> : null}
      {image ? <meta name="twitter:image" content={image} /> : null}
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
    </Helmet>
  );
}