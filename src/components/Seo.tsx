import { Helmet } from "react-helmet-async";

const SITE_URL = "https://www.bezli.cz";
const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/74a63e52-f296-4725-8ab6-4f63cec3ab3e/id-preview-a1ecc546--009616a5-51c3-4068-bcee-6f9fe2fb83cb.lovable.app-1772984815030.png";

interface SeoProps {
  title: string;
  description: string;
  /** Cesta routy včetně úvodního lomítka, např. "/licence". */
  path: string;
  /** Volitelné JSON-LD schéma (objekt nebo pole objektů). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

/** Per-route hlavička stránky – title, description, canonical a Open Graph. */
const Seo = ({ title, description, path, jsonLd, noindex }: SeoProps) => {
  const url = `${SITE_URL}${path === "/" ? "" : path}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={OG_IMAGE} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;
