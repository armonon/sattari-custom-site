import { Helmet } from 'react-helmet-async';
import { FC, ReactNode } from 'react';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
  children?: ReactNode;
}

export const SEO: FC<SEOProps> = ({
  title,
  description,
  image = '/sattari site/sattari logo.png',
  url = 'https://sattarimusic.com',
  type = 'website',
}) => {
  const fullTitle = `${title} | Sattari Music - Premium Drum Gear & Services`;

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
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="Sattari Music" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

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
