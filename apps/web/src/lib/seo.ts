export const MEETSPACE_SITE_URL = "https://meetspace.so";
export const DEFAULT_OG_IMAGE_URL = `${MEETSPACE_SITE_URL}/og.jpg`;
export const ROOT_TITLE = "Meetspace - Meeting Notes You Own";
export const ROOT_DESCRIPTION =
  "Private, bot-free meeting notes that stay under your control. Meetspace stores notes as files you own and works fully offline with on-device models or your own keys.";
export const ROOT_KEYWORDS =
  "private meeting notes, bot-free AI notes, local transcription, AI meeting notes, AI notetaker, meeting transcription, meeting summaries, BYOK AI, open source note taking, local AI";

export function getBlogOgImageUrl(slug: string) {
  return `${MEETSPACE_SITE_URL}/api/og/blog/${encodeURIComponent(slug)}`;
}

type StructuredDataNode = Record<string, unknown>;

export function getStructuredDataGraph(nodes: StructuredDataNode[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

export function getOrganizationJsonLd() {
  return {
    "@type": "Organization",
    name: "Meetspace",
    url: MEETSPACE_SITE_URL,
    logo: `${MEETSPACE_SITE_URL}/logo.svg`,
  };
}

export function getSoftwareApplicationJsonLd({
  url = MEETSPACE_SITE_URL,
  description,
  featureList,
  aggregateOffer,
}: {
  url?: string;
  description: string;
  featureList?: string[];
  aggregateOffer?: {
    lowPrice: number;
    highPrice: number;
    offerCount: number;
  };
}) {
  return {
    "@type": "SoftwareApplication",
    name: "Meetspace",
    url,
    description,
    applicationCategory: "ProductivityApplication",
    operatingSystem: "macOS",
    downloadUrl: MEETSPACE_SITE_URL,
    publisher: getOrganizationJsonLd(),
    ...(featureList ? { featureList } : {}),
    ...(aggregateOffer
      ? {
          offers: {
            "@type": "AggregateOffer",
            url,
            priceCurrency: "USD",
            ...aggregateOffer,
          },
        }
      : {}),
  };
}

export function getBreadcrumbListJsonLd(
  items: Array<{ name: string; item: string }>,
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}
