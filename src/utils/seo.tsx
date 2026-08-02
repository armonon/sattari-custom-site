import { Helmet } from 'react-helmet-async';
import { FC, ReactNode } from 'react';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
  children?: ReactNode;
  /** Product-only fields. When set (type="product"), emits the `product:*`
   * Open Graph tags that Meta's catalog crawler reads to populate Instagram/
   * Facebook Shopping — separate from the schema.org JSON-LD, which Meta's
   * catalog does not consume. */
  price?: number;
  currency?: string;
  availability?: 'in stock' | 'out of stock' | 'preorder';
  retailerId?: string;
}

export const SEO: FC<SEOProps> = ({
  title,
  description,
  image = '/sattari site/sattari logo.png',
  url = 'https://sattarimusic.com',
  type = 'website',
  price,
  currency = 'USD',
  availability = 'in stock',
  retailerId,
}) => {
  const fullTitle = `${title} | Sattari Music - Premium Drum Gear & Services`;
  const isProduct = type === 'product' && price !== undefined;
  // Meta's crawler (link previews + the Instagram/Facebook Shopping catalog)
  // requires an absolute og:image URL — a site-relative path silently fails
  // to resolve for it, even though browsers handle it fine. Image paths also
  // contain a literal space ("/sattari site/..."), which browsers auto-encode
  // when resolving a DOM src/href but which would stay a raw, invalid space
  // in this literal meta-tag string — so encode explicitly.
  const absoluteImage = encodeURI(
    image.startsWith('http') ? image : `https://sattarimusic.com${image}`
  );

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="utf-8" />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Sattari Music" />

      {/* Meta Shopping catalog (Instagram/Facebook Shop) reads these
          product:* tags directly off the page when crawling for a
          website-sourced catalog. */}
      {isProduct && <meta property="product:price:amount" content={String(price)} />}
      {isProduct && <meta property="product:price:currency" content={currency} />}
      {isProduct && <meta property="product:availability" content={availability} />}
      {isProduct && <meta property="product:brand" content="Sattari Music" />}
      {isProduct && retailerId && <meta property="product:retailer_item_id" content={retailerId} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {/* Additional */}
      <meta name="theme-color" content="#0a0a0b" />
      <link rel="canonical" href={url} />
    </Helmet>
  );
};

// Structured Data - JSON-LD
interface StructuredDataProps {
  data: Record<string, unknown>;
}

export const StructuredData: FC<StructuredDataProps> = ({ data }) => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(data)}</script>
  </Helmet>
);

// Organization Schema
export const OrganizationSchema = () => (
  <StructuredData
    data={{
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Sattari Music',
      url: 'https://sattarimusic.com',
      logo: 'https://sattarimusic.com/sattari site/sattari logo.png',
      description: 'Premium handcrafted drum gear and local music services in California',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Support',
      },
    }}
  />
);

// Product Schema
interface ProductSchemaProps {
  name: string;
  description: string;
  image: string;
  price: number;
  currency?: string;
}

export const ProductSchema: FC<ProductSchemaProps> = ({
  name,
  description,
  image,
  price,
  currency = 'USD',
}) => (
  <StructuredData
    data={{
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description,
      image,
      offers: {
        '@type': 'Offer',
        price,
        priceCurrency: currency,
      },
    }}
  />
);
